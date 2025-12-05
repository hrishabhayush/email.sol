import { Hono } from 'hono';
import { paymentMiddleware } from 'x402-hono';
import { Keypair } from '@solana/web3.js';
import { env } from '../../env';
import { ChatOpenAI } from '@langchain/openai';
import { stripHtml } from 'string-strip-html';
import { z } from 'zod';

/**
 * Email scoring endpoint with x402 payment protection.
 * Charges $0.01 per scoring request.
 * Purpose: HTTP endpoint that performs the scoring and enforces payment.
 */

console.log('[DEBUG] x402-hono paymentMiddleware imported:', typeof paymentMiddleware);
console.log('[DEBUG] Initializing score-email router with authorized facilitator');

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

    const secret = JSON.parse(env.SOLANA_PRIVATE_KEY);
    const keypair = Keypair.fromSecretKey(new Uint8Array(secret));
    // For Solana, return the public key as a base58 string
    return keypair.publicKey.toString();
}

// Get receiving wallet address
console.log('[DEBUG] Getting receiving wallet address from SOLANA_PRIVATE_KEY');
const receivingAddress = getReceivingWalletAddress();
console.log('[DEBUG] Receiving wallet address:', receivingAddress);

// Configure facilitator - using public x402.org facilitator (no API keys required)
console.log('[DEBUG] Configuring facilitator with public x402.org facilitator');
const facilitatorConfig = {
    // Use the public x402.org facilitator (no authentication required)
    url: 'https://x402.org/facilitator' as const,
};

console.log('[DEBUG] Facilitator config created:', {
    url: facilitatorConfig.url,
});

// Create the router with payment middleware
console.log('[DEBUG] Creating Hono router with payment middleware');
export const scoreEmailRouter = new Hono()
    .use(async (c, next) => {
        console.log('[DEBUG] Pre-middleware: Request received', {
            method: c.req.method,
            path: c.req.path,
            url: c.req.url,
            timestamp: new Date().toISOString(),
        });
        await next();
    })
    .use(
        paymentMiddleware(
            receivingAddress as any, // Type assertion for Solana address format
            {
                'POST /api/agent/score-email': {
                    price: '$0.01',
                    network: 'solana-devnet',
                },
            },
            facilitatorConfig
        ) as any // Type assertion to work around Hono version mismatch
    )
    .use(async (c, next) => {
        console.log('[DEBUG] Post-middleware: Request passed through payment middleware', {
            method: c.req.method,
            path: c.req.path,
            hasPaymentHeader: !!c.req.header('X-PAYMENT'),
            paymentHeader: c.req.header('X-PAYMENT') ? 'present' : 'missing',
            timestamp: new Date().toISOString(),
        });
        await next();
    })
    .post('', async (c) => {
        console.log('[DEBUG] Route handler: POST / reached - payment was verified or bypassed');
        console.log('[DEBUG] Route handler: Request details', {
            method: c.req.method,
            path: c.req.path,
            hasPaymentHeader: !!c.req.header('X-PAYMENT'),
            contentType: c.req.header('Content-Type'),
            timestamp: new Date().toISOString(),
        });

        try {
            // Extract email content from request body
            console.log('[DEBUG] Route handler: Parsing request body');
            const body = await c.req.json();
            console.log('[DEBUG] Route handler: Request body parsed', {
                hasEmailContent: !!body.emailContent,
                emailContentLength: body.emailContent?.length || 0,
            });

            const { emailContent } = body;

            if (!emailContent || typeof emailContent !== 'string') {
                console.error('[ERROR] Route handler: Invalid emailContent', {
                    type: typeof emailContent,
                    isString: typeof emailContent === 'string',
                });
                return c.json({ error: 'emailContent is required and must be a string' }, 400);
            }

            // Strip HTML and get plaintext
            console.log('[DEBUG] Route handler: Stripping HTML from email content');
            const plaintext = stripHtml(emailContent).result.trim();
            console.log('[DEBUG] Route handler: Plaintext extracted', {
                originalLength: emailContent.length,
                plaintextLength: plaintext.length,
            });

            if (!plaintext) {
                console.error('[ERROR] Route handler: Email content is empty after stripping HTML');
                return c.json({ error: 'Email content is empty after stripping HTML' }, 400);
            }

            // Initialize LangChain ChatOpenAI (same as email-scoring-tool.ts)
            console.log('[DEBUG] Route handler: Initializing ChatOpenAI', {
                model: env.OPENAI_MODEL || 'gpt-4o-mini',
                hasApiKey: !!env.OPENAI_API_KEY,
            });
            const llm = new ChatOpenAI({
                modelName: env.OPENAI_MODEL || 'gpt-4o-mini',
                temperature: 1,
                openAIApiKey: env.OPENAI_API_KEY,
            });

            // Call LLM with scoring prompt
            console.log('[DEBUG] Route handler: Calling OpenAI API for email scoring');
            const prompt = SCORING_PROMPT.replace('{emailContent}', plaintext);
            const response = await llm.invoke(prompt);
            console.log('[DEBUG] Route handler: OpenAI API response received', {
                responseType: typeof response.content,
                hasContent: !!response.content,
            });

            // Parse response as a string
            console.log('[DEBUG] Route handler: Parsing OpenAI response');
            const content = typeof response.content === 'string' ? response.content : String(response.content);
            console.log('[DEBUG] Route handler: Response content', {
                length: content.length,
                preview: content.substring(0, 100),
            });

            // Clean and parse JSON
            let jsonStr = content.trim();

            // Remove markdown code blocks if present
            if (jsonStr.startsWith('```')) {
                console.log('[DEBUG] Route handler: Removing markdown code blocks');
                const lines = jsonStr.split('\n');
                lines.shift(); // Remove first line (```json or ```)
                if (lines[lines.length - 1] === '```') {
                    lines.pop(); // Remove last line (```)
                }
                jsonStr = lines.join('\n');
            }

            // Parse JSON
            console.log('[DEBUG] Route handler: Attempting to parse JSON');
            let parsed: { score: number };
            try {
                parsed = JSON.parse(jsonStr);
                console.log('[DEBUG] Route handler: JSON parsed successfully', { score: parsed.score });
            } catch (parseError) {
                console.warn('[WARN] Route handler: JSON parse failed, trying regex fallback', {
                    error: parseError instanceof Error ? parseError.message : 'Unknown error',
                });
                // Try to extract score using regex as fallback
                const scoreMatch = jsonStr.match(/"score"\s*:\s*(\d+)/);
                if (scoreMatch) {
                    parsed = { score: parseInt(scoreMatch[1], 10) };
                    console.log('[DEBUG] Route handler: Score extracted via regex', { score: parsed.score });
                } else {
                    console.error('[ERROR] Route handler: Failed to parse LLM response', {
                        content: content.substring(0, 200),
                    });
                    throw new Error(`Failed to parse LLM response as JSON: ${content}`);
                }
            }

            // Validate score
            console.log('[DEBUG] Route handler: Validating score with schema');
            const validated = ScoreSchema.parse(parsed);
            console.log('[DEBUG] Route handler: Score validated', { score: validated.score });

            // Return score
            console.log('[DEBUG] Route handler: Returning successful response', { score: validated.score });
            return c.json({ score: validated.score });
        } catch (error) {
            console.error('[ERROR] Route handler: Error scoring email', {
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
                timestamp: new Date().toISOString(),
            });
            return c.json(
                {
                    error: 'Failed to score email',
                    message: error instanceof Error ? error.message : 'Unknown error',
                },
                500
            );
        }
    });

console.log('[DEBUG] scoreEmailRouter initialized and exported');

