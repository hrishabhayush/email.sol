import { ChatOpenAI } from '@langchain/openai';
import { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { env } from '../../env';
import { stripHtml } from 'string-strip-html';
import { randomBytes } from 'crypto';
import { x25519, RescueCipher, deserializeLE } from '@arcium-hq/client';

/**
 * Email scoring tool using OpenAI mini model via LangChain.
 * Evaluates email quality and returns a score from 0-100.
 * Supports x402 payment protocol for API calls.
 * 
 * Arcium Integration:
 * - LLM scoring happens OUTSIDE MPC (preprocessing)
 * - Score (0-100) is encrypted using x25519 + RescueCipher
 * - Encrypted score is submitted to Arcium MPC network
 * - MPC returns encrypted result without seeing plaintext
 * - Client decrypts to get verified score
 */

const SCORING_PROMPT = `Evaluate the quality and relevance of this email reply. Consider the following factors:
- Clarity: Is the message clear and easy to understand?
- Completeness: Does it address the original message adequately?
- Professionalism: Is the tone appropriate and professional?
- Relevance: Is the content relevant to the original message?
- Helpfulness: Does it provide value or useful information?

Return a JSON object with a single "score" field containing a number from 0-100, where:
- 90-100: Excellent, highly relevant and valuable
- 70-89: Good, relevant and helpful
- 50-69: Adequate, somewhat relevant
- 30-49: Poor, limited relevance
- 0-29: Very poor, irrelevant or unhelpful

Email content:
{emailContent}

Respond with ONLY valid JSON: {"score": <number>}`;

// zod schema for the score -> allows for type safety and validation at runtime
const ScoreSchema = z.object({
  score: z.number().min(0).max(100),
});

export interface EmailScoringResult {
  score: number;
}

/**
 * Arcium-encrypted scoring result.
 * Contains encrypted score ciphertext and metadata for decryption.
 */
export interface ArciumScoringResult {
  score: number;                    // Plaintext score (after decryption)
  encrypted: {
    ciphertext: number[];           // Encrypted score (32 bytes as number array)
    publicKey: Uint8Array;          // x25519 public key (32 bytes)
    nonce: Uint8Array;              // Encryption nonce (16 bytes)
    privateKey: Uint8Array;         // Ephemeral private key (for decryption)
  };
  arciumTxSignature?: string;       // Solana transaction signature (if submitted)
}

// StructuredTool automatically handles input validation, parsing, and type safety when calling tools from agents.
export class EmailScoringTool extends StructuredTool {
  private llm: ChatOpenAI;
  private x402Fetch?: typeof fetch;

  // defines a tool in LangChain terms
  constructor(options?: { x402Fetch?: typeof fetch }) {
    // calls parent class constructor with the following arguments
    // name: how the agent references it
    // description: used by LLMs when reasoning about tool usage
    // schema: expected input format
    super({
      name: 'email_scoring_tool',
      description:
        'Evaluates email quality and returns a score from 0-100 based on clarity, completeness, professionalism, relevance, and helpfulness.',
      schema: z.object({
        emailContent: z.string().describe('The plaintext email content to score'),
      }),
    });

    this.x402Fetch = options?.x402Fetch;

    // Configure ChatOpenAI with x402 fetch if provided
    const llmConfig: any = {
      modelName: env.OPENAI_MINI_MODEL || 'gpt-4o-mini',
      temperature: 0,
      openAIApiKey: env.OPENAI_API_KEY,
    };

    // If x402 fetch is provided and we have an x402 API URL, use it as proxy
    if (this.x402Fetch && env.X402_API_URL) {
      // Use x402 proxy endpoint instead of direct OpenAI API
      llmConfig.configuration = {
        baseURL: env.X402_API_URL,
      };
    }

    this.llm = new ChatOpenAI(llmConfig);
  }

  //_call method runs when the tool is invoked by LangChain.
  async _call(input: { emailContent: string }): Promise<string> {
    try {
      // Strip HTML and get plaintext
      const plaintext = stripHtml(input.emailContent).result.trim();

      if (!plaintext) {
        throw new Error('Email content is empty after stripping HTML');
      }

      // Call LLM with scoring prompt
      const prompt = SCORING_PROMPT.replace('{emailContent}', plaintext);
      const response = await this.llm.invoke(prompt);

      // Parse response as a string
      const content = typeof response.content === 'string' ? response.content : String(response.content);

      // ---- start cleaning ----
      // Try to extract JSON from response
      let jsonStr = content.trim();

      // Remove markdown code blocks if present
      if (jsonStr.startsWith('```')) {
        const lines = jsonStr.split('\n');
        lines.shift(); // Remove first line (```json or ```)
        if (lines[lines.length - 1] === '```') {
          lines.pop(); // Remove last line (```)
        }
        jsonStr = lines.join('\n');
      }

      // Parse JSON
      let parsed: { score: number };
      try {
        parsed = JSON.parse(jsonStr);
      } catch (parseError) {
        // Try to extract score using regex as fallback
        const scoreMatch = jsonStr.match(/"score"\s*:\s*(\d+)/);
        if (scoreMatch) {
          parsed = { score: parseInt(scoreMatch[1], 10) };
        } else {
          throw new Error(`Failed to parse LLM response as JSON: ${content}`);
        }
      }
      // ---- end cleaning ----

      // Validate score, ensuring it matches the schema
      const validated = ScoreSchema.parse(parsed);

      return JSON.stringify(validated);
    } catch (error) {
      console.error('[EmailScoringTool] Error scoring email:', error);

      // Check if it's an x402 payment error
      if (error instanceof Error && error.message.includes('x402')) {
        // Re-throw x402 errors so they can be handled upstream with fallback
        throw new Error(`x402 payment error: ${error.message}`);
      }

      // Return a default low score on other errors rather than failing completely
      return JSON.stringify({ score: 0 });
    }
  }
}

/**
 * Score an email using the LLM tool.
 * Returns the score (0-100) or throws an error.
 * 
 * @param emailContent - The email content to score
 * @param x402Fetch - Optional x402-wrapped fetch function for payment handling
 */
export async function scoreEmail(
  emailContent: string,
  x402Fetch?: typeof fetch
): Promise<EmailScoringResult> {
  const tool = new EmailScoringTool({ x402Fetch });
  const result = await tool._call({ emailContent });
  return JSON.parse(result) as EmailScoringResult;
}

/**
 * Prepare encrypted score for Arcium MPC submission.
 * This function:
 * 1. Gets the plaintext score from LLM
 * 2. Encrypts it using x25519 key exchange + RescueCipher
 * 3. Returns data ready for Arcium classify_email submission
 * 
 * @param emailContent - The email content to score
 * @param mxePublicKey - MXE public key from Arcium network (32 bytes)
 * @param x402Fetch - Optional x402-wrapped fetch function
 */
export async function prepareArciumScore(
  emailContent: string,
  mxePublicKey: Uint8Array,
  x402Fetch?: typeof fetch
): Promise<ArciumScoringResult> {
  // Step 1: Get plaintext score from LLM (outside MPC)
  const { score } = await scoreEmail(emailContent, x402Fetch);
  
  // Step 2: Generate ephemeral x25519 keypair for encryption
  const privateKey = x25519.utils.randomSecretKey();
  const publicKey = x25519.getPublicKey(privateKey);
  
  // Step 3: Derive shared secret using ECDH
  const sharedSecret = x25519.getSharedSecret(privateKey, mxePublicKey);
  
  // Step 4: Create cipher and encrypt the score
  const cipher = new RescueCipher(sharedSecret);
  const nonce = new Uint8Array(randomBytes(16));
  const ciphertexts = cipher.encrypt([BigInt(score)], nonce);
  const ciphertext = ciphertexts[0]; // First (and only) ciphertext
  
  return {
    score,
    encrypted: {
      ciphertext,
      publicKey,
      nonce,
      privateKey, // Store for later decryption
    },
  };
}

/**
 * Full Arcium integration types for classify_email circuit.
 * Use these when submitting to the Arcium Solana program.
 */
export interface ClassifyEmailParams {
  computationOffset: bigint;        // Unique computation ID
  encryptedScore: number[];         // Array.from(ciphertext) - 32 bytes
  pubKey: number[];                 // Array.from(publicKey) - 32 bytes  
  nonce: bigint;                    // deserializeLE(nonce) as bigint
}

/**
 * Convert ArciumScoringResult to ClassifyEmailParams for Solana submission.
 * Uses Arcium's deserializeLE for proper nonce conversion.
 */
export function toClassifyEmailParams(
  result: ArciumScoringResult,
  computationOffset: bigint
): ClassifyEmailParams {
  // Use Arcium's deserializeLE for proper little-endian conversion
  const nonceValue = deserializeLE(result.encrypted.nonce);
  
  return {
    computationOffset,
    encryptedScore: Array.from(result.encrypted.ciphertext),
    pubKey: Array.from(result.encrypted.publicKey),
    nonce: nonceValue,
  };
}

/**
 * Decrypt an encrypted score from Arcium callback.
 * Use this after receiving the ScoreEvent from the MPC network.
 * 
 * @param encryptedScore - The encrypted score ciphertext (32 bytes as number array)
 * @param nonce - The nonce used for encryption (16 bytes)
 * @param privateKey - The ephemeral private key used during encryption
 * @param mxePublicKey - MXE public key from Arcium network
 */
export function decryptArciumScore(
  encryptedScore: number[],
  nonce: Uint8Array,
  privateKey: Uint8Array,
  mxePublicKey: Uint8Array
): number {
  const sharedSecret = x25519.getSharedSecret(privateKey, mxePublicKey);
  const cipher = new RescueCipher(sharedSecret);
  const decrypted = cipher.decrypt([encryptedScore], nonce)[0];
  return Number(decrypted);
}

/**
 * Decrypt using the stored result from prepareArciumScore.
 * Convenience function that uses the privateKey stored in the result.
 * 
 * @param result - The ArciumScoringResult from prepareArciumScore
 * @param callbackScore - The encrypted score from ScoreEvent callback
 * @param callbackNonce - The nonce from ScoreEvent callback
 * @param mxePublicKey - MXE public key from Arcium network
 */
export function decryptArciumScoreFromResult(
  result: ArciumScoringResult,
  callbackScore: number[],
  callbackNonce: Uint8Array,
  mxePublicKey: Uint8Array
): number {
  return decryptArciumScore(
    callbackScore,
    callbackNonce,
    result.encrypted.privateKey,
    mxePublicKey
  );
}
