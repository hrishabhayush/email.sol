import { ChatOpenAI } from '@langchain/openai';
import { StructuredTool } from '@langchain/core/tools';
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

Return a JSON object with a single "score" field containing a number from 0-100, where:
- 90-100: Excellent, highly relevant and valuable
- 70-89: Good, relevant and helpful
- 50-69: Adequate, somewhat relevant
- 30-49: Poor, limited relevance
- 0-29: Very poor, irrelevant or unhelpful

Original Email: {originalEmailSection}
Reply Email: {emailContent}

Respond with ONLY valid JSON: {"score": <number>}`;

// zod schema for the score -> allows for type safety and validation at runtime
const ScoreSchema = z.object({
  score: z.number().min(0).max(100),
});

export interface EmailScoringResult {
  score: number;
}

// StructuredTool automatically handles input validation, parsing, and type safety when calling tools from agents.
export class EmailScoringTool extends StructuredTool {
  private llm: ChatOpenAI;

  // defines a tool in LangChain terms
  constructor() {
    // calls parent class constructor with the following arguments
    // name: how the agent references it
    // description: used by LLMs when reasoning about tool usage
    // schema: expected input format
    super({
      name: 'email_scoring_tool',
      description:
        'Evaluates email reply quality and returns a score from 0-100 based on clarity, completeness, professionalism, relevance, and helpfulness. Can optionally include the original email for context.',
      schema: z.object({
        emailContent: z.string().describe('The plaintext email content to score'),
      }),
    });

    this.llm = new ChatOpenAI({
      modelName: env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0,
      openAIApiKey: env.OPENAI_API_KEY,
    });
  }

  //_call method runs when the tool is invoked by LangChain.
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
      // Return a default low score on error rather than failing completely
      return JSON.stringify({ score: 0 });
    }
  }
}

/**
 * Score an email using the LLM tool.
 * Returns the score (0-100) or throws an error.
 */
export async function scoreEmail(emailContent: string, originalEmailContent?: string): Promise<EmailScoringResult> {
  const tool = new EmailScoringTool();
  const result = await tool._call({ emailContent, originalEmailContent });
  return JSON.parse(result) as EmailScoringResult;
}

