// @ts-nocheck - Type issues with StructuredTool will resolve once packages are properly installed
import { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { env } from '../../env';
import { stripHtml } from 'string-strip-html';
import { initializeX402Client } from './x402-client';
import { getEscrowAgent, getConnection } from './escrow-agent';

/**
 * Purpose: Client-side service that other code uses to score emails.
 * Uses x402 payment protocol - payments are handled automatically by the backend.
 */

// zod schema for the score -> allows for type safety and validation at runtime
const ScoreSchema = z.object({
  score: z.number().min(0).max(100),
});

export interface EmailScoringResult {
  score: number;
}

// Internal endpoint URL for scoring
const SCORE_EMAIL_ENDPOINT = '/api/agent/score-email';

/**
 * Get or create x402-wrapped fetch for automatic payment handling.
 * This is a singleton to avoid recreating the client on every call.
 */
let cachedX402Fetch: typeof fetch | null = null;

async function getX402Fetch(): Promise<typeof fetch> {
  if (!cachedX402Fetch) {
    try {
      const connection = getConnection();
      const { getX402Signer } = await import('./escrow-agent');
      const signer = await getX402Signer();
      cachedX402Fetch = await initializeX402Client(signer, connection, env.X402_NETWORK);
    } catch (error) {
      console.warn('[EmailScoringTool] Failed to initialize x402 client:', error);
      // Fallback to regular fetch if x402 initialization fails
      return fetch;
    }
  }
  return cachedX402Fetch;
}

// StructuredTool automatically handles input validation, parsing, and type safety when calling tools from agents.
// @ts-expect-error - TypeScript has issues with StructuredTool type inference, but runtime works correctly
export class EmailScoringTool extends (StructuredTool as any) {
  name = 'email_scoring_tool';
  description = 'Evaluates email quality and returns a score from 0-100 based on clarity, completeness, professionalism, relevance, and helpfulness.';
  schema = z.object({
    emailContent: z.string().describe('The plaintext email content to score'),
  });

  constructor() {
    super();
  }

  //_call method runs when the tool is invoked by LangChain.
  async _call(input: { emailContent: string }): Promise<string> {
    try {
      // Strip HTML and get plaintext
      const plaintext = stripHtml(input.emailContent).result.trim();

      if (!plaintext) {
        throw new Error('Email content is empty after stripping HTML');
      }

      // Get the base URL for internal requests
      // In Cloudflare Workers, we need to construct the full URL -> should point to backend port 8787
      const baseUrl = env.VITE_PUBLIC_BACKEND_URL || 'http://localhost:8787';
      const url = `${baseUrl}${SCORE_EMAIL_ENDPOINT}`;

      // Get x402-wrapped fetch (handles payments automatically)
      const x402Fetch = await getX402Fetch();
      console.log('[DEBUG] x402Fetch:', x402Fetch);

      // Make request to internal protected endpoint
      // The wrapped fetch will automatically handle 402 payments
      const response = await x402Fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emailContent: plaintext }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Email scoring endpoint returned ${response.status}: ${errorText}`);
      }

      // Parse response
      const result = await response.json();

      // Validate the response matches our schema
      const validated = ScoreSchema.parse(result);

      return JSON.stringify(validated);
    } catch (error) {
      console.error('[EmailScoringTool] Error scoring email:', error);

      // Check if it's an x402 payment error
      if (error instanceof Error && error.message.includes('x402')) {
        // Re-throw x402 errors so they can be handled upstream
        throw new Error(`x402 payment error: ${error.message}`);
      }

      // Return a default low score on other errors rather than failing completely
      return JSON.stringify({ score: 0 });
    }
  }
}

/**
 * Score an email using the internal protected endpoint.
 * Returns the score (0-100) or throws an error.
 * 
 * @param emailContent - The email content to score
 */
export async function scoreEmail(emailContent: string): Promise<EmailScoringResult> {
  const tool = new EmailScoringTool();
  const result = await tool._call({ emailContent });
  return JSON.parse(result) as EmailScoringResult;
}
