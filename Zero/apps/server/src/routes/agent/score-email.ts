import { Hono } from 'hono';
import { paymentMiddleware } from 'x402-hono';
import { facilitator } from '@coinbase/x402';
import { Keypair } from '@solana/web3.js';
import { env } from '../../env';
import bs58 from 'bs58';
import { ChatOpenAI } from '@langchain/openai';
import { stripHtml } from 'string-strip-html';
import { z } from 'zod';

/**
 * Email scoring endpoint with x402 payment protection.
 * Charges $0.01 per scoring request.
 * Purpose: HTTP endpoint that performs the scoring and enforces payment.
 */

// TODO: do we even have the original message?? pull it from email thread when you press "reply"
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

const ScoreSchema = z.object({
    score: z.number().min(0).max(100),
});

// Get receiving wallet address from SOLANA_PRIVATE_KEY
function getReceivingWalletAddress(): string {
    if (!env.SOLANA_PRIVATE_KEY) {
        throw new Error('SOLANA_PRIVATE_KEY is not set in environment variables');
    }

    const keypair = Keypair.fromSecretKey(bs58.decode(env.SOLANA_PRIVATE_KEY));
    // For Solana, return the public key as a base58 string
    return keypair.publicKey.toString();
}

// Create the router with payment middleware
export const scoreEmailRouter = new Hono()
    .use(
        paymentMiddleware(
            getReceivingWalletAddress() as any, // Type assertion for Solana address format
            {
                // For the HTTP POST request to path /, require a $0.01 payment on Solana devnet before allowing the handler to run.
                // x402 intercepts any HTTP request that follows: .post('/', async c => { ... }) by returning a 402 response if the payment is not made.
                'POST /': {
                    price: '$0.01',
                    network: 'solana-devnet',
                },
            },
            {
                url: 'https://api.cdp.coinbase.com/platform/v2/x402',
            }
        ) as any 
    )
    .post('/', async (c) => { // handler runs only after the payment middleware authorizes the request
        try {
            // Extract email content from request body
            const { emailContent } = await c.req.json();

            if (!emailContent || typeof emailContent !== 'string') {
                return c.json({ error: 'emailContent is required and must be a string' }, 400);
            }

            // Strip HTML and get plaintext
            const plaintext = stripHtml(emailContent).result.trim();

            if (!plaintext) {
                return c.json({ error: 'Email content is empty after stripping HTML' }, 400);
            }

            // Initialize LangChain ChatOpenAI (same as email-scoring-tool.ts)
            const llm = new ChatOpenAI({
                modelName: env.OPENAI_MODEL || 'gpt-4o-mini',
                temperature: 0,
                openAIApiKey: env.OPENAI_API_KEY,
            });

            // Call LLM with scoring prompt
            const prompt = SCORING_PROMPT.replace('{emailContent}', plaintext);
            const response = await llm.invoke(prompt);

            // Parse response as a string
            const content = typeof response.content === 'string' ? response.content : String(response.content);

            // Clean and parse JSON
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

            // Validate score
            const validated = ScoreSchema.parse(parsed);

            // Return score
            return c.json({ score: validated.score });
        } catch (error) {
            console.error('[score-email] Error scoring email:', error);
            return c.json(
                {
                    error: 'Failed to score email',
                    message: error instanceof Error ? error.message : 'Unknown error',
                },
                500
            );
        }
    });

