import { disableBrainFunction, getPrompts } from '../../lib/brain';
import { EProviders, EPrompts, type ISubscribeBatch } from '../../types';
import { activeConnectionProcedure, router } from '../trpc';
import { setSubscribedState } from '../../lib/utils';
import { env } from '../../env';
import { z } from 'zod';

const labelSchema = z.object({
  name: z.string(),
  usecase: z.string(),
});

const labelsSchema = z.array(labelSchema);

export const brainRouter = router({
  enableBrain: activeConnectionProcedure.mutation(async ({ ctx }) => {
    const connection = ctx.activeConnection as { id: string; providerId: EProviders };
    await setSubscribedState(connection.id, connection.providerId);
    await env.subscribe_queue.send({
      connectionId: connection.id,
      providerId: connection.providerId,
    } as ISubscribeBatch);
    return true;
    // return await enableBrainFunction(connection);
  }),
  disableBrain: activeConnectionProcedure.mutation(async ({ ctx }) => {
    const connection = ctx.activeConnection as { id: string; providerId: EProviders };
    return await disableBrainFunction(connection);
  }),

  generateSummary: activeConnectionProcedure
    .input(
      z.object({
        threadId: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      try {
        const { threadId } = input;
        
        // Check if VECTORIZE is available
        if (!env.VECTORIZE) {
          console.warn('[generateSummary] VECTORIZE not available');
          return null;
        }

        const response = await env.VECTORIZE.getByIds([threadId]);
        
        if (response.length && response?.[0]?.metadata?.['summary']) {
          const result = response[0].metadata as { summary: string; connection: string };
          
          // Verify connection matches
          if (result.connection !== ctx.activeConnection.id) {
            return null;
          }

          // Check if AI is available
          if (!env.AI) {
            console.warn('[generateSummary] AI not available');
            return null;
          }

          try {
            const shortResponse = await env.AI.run('@cf/facebook/bart-large-cnn', {
              input_text: result.summary,
            });
            
            // Handle different response formats
            const summary = 'summary' in shortResponse 
              ? shortResponse.summary 
              : typeof shortResponse === 'string' 
                ? shortResponse 
                : null;

            if (!summary) {
              console.warn('[generateSummary] AI response missing summary');
              return null;
            }

            return {
              data: {
                short: summary,
              },
            };
          } catch (aiError) {
            console.error('[generateSummary] AI.run failed:', aiError);
            return null;
          }
        }
        
        return null;
      } catch (error) {
        console.error('[generateSummary] Error generating summary:', error);
        // Return null instead of throwing to prevent 500 errors
        return null;
      }
    }),
  getState: activeConnectionProcedure.query(async ({ ctx }) => {
    const connection = ctx.activeConnection;
    const state = await env.subscribed_accounts.get(`${connection.id}__${connection.providerId}`);
    if (!state || state === 'pending') return { enabled: false };
    return { enabled: true };
  }),
  getLabels: activeConnectionProcedure
    .output(
      z.array(
        z.object({
          name: z.string(),
          usecase: z.string(),
        }),
      ),
    )
    .query(async ({ ctx }) => {
      const connection = ctx.activeConnection;
      const labels = await env.connection_labels.get(connection.id);
      try {
        return labels ? (JSON.parse(labels) as z.infer<typeof labelsSchema>) : [];
      } catch (error) {
        console.error(`[GET_LABELS] Error parsing labels for ${connection.id}:`, error);
        return [];
      }
    }),
  getPrompts: activeConnectionProcedure.query(async ({ ctx }) => {
    const connection = ctx.activeConnection;
    return await getPrompts({ connectionId: connection.id });
  }),
  updatePrompt: activeConnectionProcedure
    .input(
      z.object({
        promptType: z.nativeEnum(EPrompts),
        content: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const connection = ctx.activeConnection;

      const promptName = `${connection.id}-${input.promptType}`;

      await env.prompts_storage.put(promptName, input.content);

      return { success: true };
    }),
  updateLabels: activeConnectionProcedure
    .input(
      z.object({
        labels: labelsSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const connection = ctx.activeConnection;
      console.log(input.labels);

      const labels = labelsSchema.parse(input.labels);
      console.log(labels);

      await env.connection_labels.put(connection.id, JSON.stringify(labels));
      return { success: true };
    }),
});
