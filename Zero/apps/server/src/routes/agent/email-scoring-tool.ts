import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';
import { env } from '../../env';
import { stripHtml } from 'string-strip-html';

/**
 * Email scoring tool using OpenAI mini model via LangChain.
 * Evaluates email quality and returns a score from 0-100.
 */

const SCORING_PROMPT = `Evaluate the quality and relevance of this email reply in relation to the original email. Consider:

1. Clarity: Is the message clear, well-structured, and easy to understand?
2. Completeness: Does it adequately address all points/questions from the original email?
3. Professionalism: Is the tone appropriate, respectful, and professional?
4. Relevance: Is the content directly relevant to the original message?
5. Helpfulness: Does it provide value, useful information, or actionable responses?
6. Grammar & Style: Are there spelling errors, awkward phrasing, or unclear sentences?

Return JSON only: {"score": 0-100, "recommendations": ["suggestion1", "suggestion2", ...]}

Score ranges:
- 90-100: Excellent - highly relevant, valuable, and well-written
- 70-89: Good - relevant and helpful with minor issues
- 50-69: Adequate - somewhat relevant but needs improvement
- 30-49: Poor - limited relevance or significant issues
- 0-29: Very poor - irrelevant, unhelpful, or poorly written

IMPORTANT - Recommendations rules:
- If score < 70: You MUST provide 3-5 specific, actionable improvement suggestions in the recommendations array
- If score >= 70: Use empty array: []
- Each recommendation should be a clear, actionable string (e.g., "Improve clarity by restructuring sentences" or "Add more specific details about the project timeline")
- Never return an empty recommendations array when score < 70

Original Email: {originalEmailSection}
Reply Email: {emailContent}

Return ONLY valid JSON (no markdown, no code blocks, just JSON): {"score": <number>, "recommendations": ["suggestion1", "suggestion2", ...]}`;

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
  private progressCallback?: (step: 'calculating_score' | 'creating_recommendations', data?: any) => void;
  private calculatingScoreStartTime?: number;
  private creatingRecommendationsStartTime?: number;

  constructor(progressCallback?: (step: 'calculating_score' | 'creating_recommendations', data?: any) => void) {
    this.llm = new ChatOpenAI({
      modelName: env.OPENAI_MODEL,
      temperature: 1, 
      openAIApiKey: env.OPENAI_API_KEY
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
      this.calculatingScoreStartTime = Date.now();
      this.progressCallback?.('calculating_score');

      // Set a timeout to transition to "creating_recommendations" after max 5 seconds
      const maxCalculatingTime = 5000; // 5 seconds maximum
      let hasTransitioned = false;
      const transitionTimeout = setTimeout(() => {
        if (!hasTransitioned) {
          this.creatingRecommendationsStartTime = Date.now();
          this.progressCallback?.('creating_recommendations');
          hasTransitioned = true;
        }
      }, maxCalculatingTime);

      const response = await this.llm.invoke([{ role: 'user', content: prompt }]);

      // Clear the timeout since LLM completed
      clearTimeout(transitionTimeout);

      // If we haven't transitioned yet (LLM completed in < 5 seconds), transition now
      if (!hasTransitioned) {
        this.creatingRecommendationsStartTime = Date.now();
        this.progressCallback?.('creating_recommendations');
        hasTransitioned = true;
      }

      

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
        console.error('[EmailScoringTool] JSON parse error:', parseError);
        console.error('[EmailScoringTool] Raw response content:', content);
        console.error('[EmailScoringTool] Cleaned JSON string:', jsonStr);

        // Try to extract score and recommendations using regex as fallback
        const scoreMatch = jsonStr.match(/"score"\s*:\s*(\d+)/);
        const recommendationsMatch = jsonStr.match(/"recommendations"\s*:\s*\[(.*?)\]/s);

        if (scoreMatch) {
          const score = parseInt(scoreMatch[1], 10);
          let recommendations: string[] = [];

          // Try to extract recommendations array
          if (recommendationsMatch && recommendationsMatch[1]) {
            // Extract individual recommendation strings
            const recMatches = recommendationsMatch[1].match(/"([^"]+)"/g);
            if (recMatches) {
              recommendations = recMatches.map(rec => rec.replace(/^"|"$/g, ''));
            }
          }

          parsed = { score, recommendations };
          console.log('[EmailScoringTool] Fallback parsing successful:', { score, recommendationsCount: recommendations.length });
        } else {
          throw new Error(`Failed to parse LLM response as JSON: ${content}`);
        }
      }
      // ---- end cleaning ----

      // Ensure recommendations array exists and log if missing
      if (!parsed.recommendations || !Array.isArray(parsed.recommendations)) {
        console.warn('[EmailScoringTool] Recommendations missing or invalid, setting to empty array. Parsed:', parsed);
        parsed.recommendations = [];
      } else {
        console.log('[EmailScoringTool] Successfully parsed:', {
          score: parsed.score,
          recommendationsCount: parsed.recommendations.length,
          recommendations: parsed.recommendations
        });
      }

      // If score is low (< 70) but recommendations are empty, generate fallback recommendations
      if (parsed.score < 70 && (!parsed.recommendations || parsed.recommendations.length === 0)) {
        console.warn('[EmailScoringTool] Score is below 70 but no recommendations provided. Generating fallback recommendations.');
        parsed.recommendations = [
          'Review the clarity and structure of your message',
          'Ensure all questions from the original email are addressed',
          'Check for grammar, spelling, and professional tone',
          'Add more specific details and actionable information',
          'Improve the overall relevance and helpfulness of your response'
        ];
      }

      // Validate score, ensuring it matches the schema
      const validated = ScoreSchema.parse(parsed);

      // Ensure minimum time for "creating_recommendations" step (1.5 seconds)
      const recommendationsElapsed = Date.now() - (this.creatingRecommendationsStartTime || Date.now());
      const minRecommendationsTime = 1500; // 1.5 seconds minimum
      if (recommendationsElapsed < minRecommendationsTime) {
        await new Promise(resolve => setTimeout(resolve, minRecommendationsTime - recommendationsElapsed));
      }

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
export type ScoringProgressCallback = (step: 'reading_input' | 'calculating_score' | 'creating_recommendations', data?: any) => void;

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
    const internalProgressCallback = (step: 'calculating_score' | 'creating_recommendations') => {
      progressCallback?.(step);
    };
    const tool = new EmailScoringTool(internalProgressCallback);

    // Step 2 & 3 happen inside _call (calculating_score transitions to creating_recommendations)
    // Timing is handled inside _call to ensure proper step visibility
    const result = await tool._call({ emailContent, originalEmailContent });

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

