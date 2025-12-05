import { Hono } from 'hono';
import { paymentMiddleware } from 'x402-hono';
import { Keypair } from '@solana/web3.js';
import { env } from '../../env';
import { ChatOpenAI } from '@langchain/openai';
import { stripHtml } from 'string-strip-html';
import { z } from 'zod';
import { scoreEmail } from './email-scoring-tool';

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
        paymentMiddleware( // returns 402
            receivingAddress as any, // Type assertion for Solana address format
            {
                'POST /api/agent/score-email': {
                    price: '$0.01',
                    network: 'devnet',
                },
            },
            facilitatorConfig
        ) as any // Type assertion to work around Hono version mismatch
    )
    .use(async (c, next) => {
        // Log payment header status before calling next
        const hasPaymentHeader = !!c.req.header('X-PAYMENT');
        console.log('[DEBUG] Post-middleware: Request passed through payment middleware', {
            method: c.req.method,
            path: c.req.path,
            hasPaymentHeader,
            paymentHeader: c.req.header('X-PAYMENT') ? 'present' : 'missing',
            timestamp: new Date().toISOString(),
        });

        // Run the next middleware in the chain (or the route handler if this is the last middleware) and wait for it to finish before continuing.
        await next();

        // After next(), check if response is 402 and log the body
        if (c.res.status === 402) {
            console.log('[DEBUG] 402 Payment Required response detected');

            // Clone the response to read the body without consuming it
            const clonedResponse = c.res.clone();
            try {
                const responseBody = await clonedResponse.json();
                console.log('[DEBUG] 402 Response Body:', JSON.stringify(responseBody, null, 2));
            } catch (error) {
                // If JSON parsing fails, try as text
                const clonedResponse2 = c.res.clone();
                const responseText = await clonedResponse2.text();
                console.log('[DEBUG] 402 Response Body (text):', responseText);
            }
        }
    })
    .post('', async (c) => { //full url path: /api/agent/score-email -> if u run POST /api/agent/score-email/ -> THIS post middleware runs, not the /test post middleware
        console.log('[DEBUG] Route handler: POST / reached - payment was verified');
        console.log('[DEBUG] Route handler: Payment verified, proceeding with email scoring', {
            method: c.req.method,
            path: c.req.path,
            hasPaymentHeader: !!c.req.header('X-PAYMENT'),
            timestamp: new Date().toISOString(),
        });

        try {
            // Extract email content from request body
            const body = await c.req.json();
            const { emailContent } = body;

            if (!emailContent || typeof emailContent !== 'string') {
                console.error('[ERROR] Route handler: Invalid emailContent');
                return c.json({ error: 'emailContent is required and must be a string' }, 400);
            }

            // Strip HTML and get plaintext
            const plaintext = stripHtml(emailContent).result.trim();

            if (!plaintext) {
                console.error('[ERROR] Route handler: Email content is empty after stripping HTML');
                return c.json({ error: 'Email content is empty after stripping HTML' }, 400);
            }

            console.log('[DEBUG] Route handler: Calling OpenAI for email scoring', {
                plaintextLength: plaintext.length,
            });

            // Initialize LangChain ChatOpenAI and score the email
            const llm = new ChatOpenAI({
                modelName: env.OPENAI_MODEL || 'gpt-4o-mini',
                temperature: 1,
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

            console.log('[DEBUG] Route handler: Email scoring complete', { score: validated.score });
            return c.json({ score: validated.score });
        } catch (error) {
            console.error('[ERROR] Route handler: Error scoring email', {
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
            });
            return c.json(
                {
                    error: 'Failed to score email',
                    message: error instanceof Error ? error.message : 'Unknown error',
                },
                500
            );
        }
    })
    // Test endpoint to trigger full x402 payment flow
    // This endpoint calls scoreEmail() which will:
    // 1. Initialize x402 client (initializeX402Client)
    // 2. Call protected endpoint with wrapped fetch
    // 3. Handle 402 payment automatically
    // 4. Return the score
    // Use: POST /api/agent/score-email/test
    .post('/test', async (c) => { //full url path: /api/agent/score-email/test
        console.log('[DEBUG] Test endpoint: /test called - will trigger full x402 flow');

        try {
            const body = await c.req.json();
            const { emailContent } = body;

            if (!emailContent || typeof emailContent !== 'string') {
                return c.json({ error: 'emailContent is required and must be a string' }, 400);
            }

            console.log('[DEBUG] Test endpoint: Calling scoreEmail() - this will initialize x402 client');
            console.log('[DEBUG] Test endpoint: Email content length:', emailContent.length);

            // This will trigger the full flow:
            // 1. scoreEmail() -> EmailScoringTool._call()
            // 2. getX402Fetch() -> initializeX402Client() (FIRST TIME IT RUNS)
            // 3. Wrapped fetch calls /api/agent/score-email
            // 4. Gets 402, automatically pays, retries
            // 5. Returns score
            const result = await scoreEmail(emailContent);

            console.log('[DEBUG] Test endpoint: scoreEmail() completed successfully', {
                score: result.score,
            });

            return c.json({
                success: true,
                score: result.score,
                message: 'Full x402 payment flow completed successfully',
            });
        } catch (error) {
            console.error('[ERROR] Test endpoint: Error in scoreEmail()', {
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
            });
            return c.json(
                {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                },
                500
            );
        }
    });

console.log('[DEBUG] scoreEmailRouter initialized and exported');
console.log('[DEBUG] Routes available:');
console.log('[DEBUG]   - POST /api/agent/score-email (protected, requires payment)');
console.log('[DEBUG]   - POST /api/agent/score-email/test (test endpoint, triggers full flow)');

