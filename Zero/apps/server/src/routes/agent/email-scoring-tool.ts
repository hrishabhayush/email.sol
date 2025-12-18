import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';
import { env } from '../../env';
import { stripHtml } from 'string-strip-html';

/**
 * Email scoring tool using OpenAI mini model via LangChain.
 * Evaluates email quality and returns a score from 0-100.
 */

const SCORING_PROMPT = `Evaluate the quality and relevance of this email reply. Consider the following factors:
- Clarity: Is the message clear and easy to understand?
- Completeness: Does it address the original message adequately?
- Professionalism: Is the tone appropriate and professional?
- Relevance: Is the content relevant to the original message?
- Helpfulness: Does it provide value or useful information?

Return a JSON object with a "score" field (number from 0-100) and a "recommendations" field (array of strings with specific improvement suggestions). The score ranges are:
- 90-100: Excellent, highly relevant and valuable
- 70-89: Good, relevant and helpful
- 50-69: Adequate, somewhat relevant
- 30-49: Poor, limited relevance
- 0-29: Very poor, irrelevant or unhelpful

For recommendations: If the score is below 70, provide 3-5 specific, actionable suggestions for improvement. If the score is 70 or above, provide an empty array.

Original Email: {originalEmailSection}
Reply Email: {emailContent}

Respond with ONLY valid JSON: {"score": <number>, "recommendations": ["suggestion1", "suggestion2", ...]}`;

// zod schema for the score -> allows for type safety and validation at runtime
const ScoreSchema = z.object({
  score: z.number().min(0).max(100),
  recommendations: z.array(z.string()),
});

export interface EmailScoringResult {
  score: number;
  recommendations: string[];
}

// Email scoring tool class for LLM-based email quality evaluation
export class EmailScoringTool {
  private llm: ChatOpenAI;
  private progressCallback?: (step: 'calculating_score' | 'parsing_results', data?: any) => void;

  constructor(progressCallback?: (step: 'calculating_score' | 'parsing_results', data?: any) => void) {
    this.llm = new ChatOpenAI({
      modelName: env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 1,
      openAIApiKey: env.OPENAI_API_KEY,
    });
    this.progressCallback = progressCallback;
  }

  // Call method to score an email
  async _call(input: { emailContent: string; originalEmailContent?: string }): Promise<string> {
    try {
      // Strip HTML and get plaintext
      const plaintext = stripHtml(input.emailContent).result.trim();

      if (!plaintext) {
        throw new Error('Email content is empty after stripping HTML');
      }

      // Process original email content if provided
      const originalText = input.originalEmailContent
        ? stripHtml(input.originalEmailContent).result.trim()
        : '';

      const originalEmailSection = originalText
        ? `Original Email:\n${originalText}\n\n`
        : '';

      // Call LLM with scoring prompt
      const prompt = SCORING_PROMPT
        .replace('{originalEmailSection}', originalEmailSection)
        .replace('{emailContent}', plaintext);

      // Step 2: Calculating score - only when LLM is actually invoked
      this.progressCallback?.('calculating_score');

      const response = await this.llm.invoke([{ role: 'user', content: prompt }]);

      // Step 3: Parsing results - right after getting response from LLM
      this.progressCallback?.('parsing_results');

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
      let parsed: { score: number; recommendations?: string[] };
      try {
        parsed = JSON.parse(jsonStr);
      } catch (parseError) {
        // Try to extract score using regex as fallback
        const scoreMatch = jsonStr.match(/"score"\s*:\s*(\d+)/);
        if (scoreMatch) {
          parsed = { score: parseInt(scoreMatch[1], 10), recommendations: [] };
        } else {
          throw new Error(`Failed to parse LLM response as JSON: ${content}`);
        }
      }
      // ---- end cleaning ----

      // Ensure recommendations array exists
      if (!parsed.recommendations || !Array.isArray(parsed.recommendations)) {
        parsed.recommendations = [];
      }

      // Validate score, ensuring it matches the schema
      const validated = ScoreSchema.parse(parsed);

      return JSON.stringify(validated);
    } catch (error) {
      console.error('[EmailScoringTool] Error scoring email:', error);
      // Return a default low score on error rather than failing completely
      return JSON.stringify({ score: 0, recommendations: [] });
    }
  }
}

/**
 * Progress callback type for tracking scoring stages
 */
export type ScoringProgressCallback = (step: 'reading_input' | 'calculating_score' | 'parsing_results' | 'creating_recommendations', data?: any) => void;

/**
 * Score an email using the LLM tool.
 * Returns the score (0-100) and recommendations or throws an error.
 */
export async function scoreEmail(
  emailContent: string,
  originalEmailContent?: string,
  progressCallback?: ScoringProgressCallback
): Promise<EmailScoringResult> {
  try {
    // Step 1: Reading input
    progressCallback?.('reading_input', { emailLength: emailContent.length });

    // Create tool with progress callback for internal steps
    const internalProgressCallback = (step: 'calculating_score' | 'parsing_results') => {
      progressCallback?.(step);
    };
    const tool = new EmailScoringTool(internalProgressCallback);

    // Step 2 & 3 happen inside _call (calculating_score and parsing_results)
    const result = await tool._call({ emailContent, originalEmailContent });

    // Step 4: Creating recommendations (after parsing is complete)
    progressCallback?.('creating_recommendations');

    const parsed = JSON.parse(result) as EmailScoringResult;

    // Ensure recommendations array exists
    if (!parsed.recommendations || !Array.isArray(parsed.recommendations)) {
      parsed.recommendations = [];
    }

    return parsed;
  } catch (error) {
    console.error('[scoreEmail] Error:', error);
    throw error;
  }
}

