import {
  IGetThreadResponseSchema,
  IGetThreadsResponseSchema,
  type IGetThreadsResponse,
} from '../../lib/driver/types';
import { activeDriverProcedure, router, privateProcedure } from '../trpc';
import { getZeroAgent, getZeroClient } from '../../lib/server-utils';
import { processEmailHtml } from '../../lib/email-processor';
import { defaultPageSize, FOLDERS } from '../../lib/utils';
import { serializedFileSchema } from '../../lib/schemas';
import type { DeleteAllSpamResponse } from '../../types';
import { getContext } from 'hono/context-storage';
import { type HonoContext } from '../../ctx';
import { env } from 'cloudflare:workers';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { scoreEmail, type ScoringProgressCallback } from '../../routes/agent/email-scoring-tool';
import { decide } from '../../routes/agent/escrow-decision';
import { getEmailStatus } from '../../lib/email-status';

// In-memory progress cache for email scoring
// Key: requestId, Value: { step: string, data?: any, completed?: boolean, result?: any }
const scoringProgressCache = new Map<string, {
  step: 'reading_input' | 'calculating_score' | 'creating_recommendations' | 'completed';
  data?: any;
  completed?: boolean;
  result?: { score: number; recommendations: string[]; decision: 'RELEASE' | 'WITHHOLD' };
  error?: string;
}>();

const senderSchema = z.object({
  name: z.string().optional(),
  email: z.string(),
});

// const getFolderLabelId = (folder: string) => {
//   // Handle special cases first
//   if (folder === 'bin') return 'TRASH';
//   if (folder === 'archive') return ''; // Archive doesn't have a specific label

//   // For other folders, convert to uppercase (same as database method)
//   return folder.toUpperCase();
// };

export const mailRouter = router({
  get: activeDriverProcedure
    .input(
      z.object({
        id: z.string(),
        forceFresh: z.boolean().optional().default(false), // Force fetch from Gmail (bypass cache)
      }),
    )
    .output(IGetThreadResponseSchema)
    .query(async ({ input, ctx }) => {
      const { activeConnection } = ctx;
      const executionCtx = getContext<HonoContext>().executionCtx;
      const agent = await getZeroClient(activeConnection.id, executionCtx);
      const threadData = await agent.getThread(input.id, true, input.forceFresh);

      if(!threadData) {
        console.error('[THREAD DEBUG - No thread data found]');
      }

      return threadData;
    }),
  count: activeDriverProcedure
    .output(
      z.array(
        z.object({
          count: z.number().optional(),
          label: z.string().optional(),
        }),
      ),
    )
    .query(async ({ ctx }) => {
      const { activeConnection } = ctx;
      const agent = await getZeroAgent(activeConnection.id);
      return await agent.count();
    }),
  listThreads: activeDriverProcedure
    .input(
      z.object({
        folder: z.string().optional().default('inbox'),
        q: z.string().optional().default(''),
        maxResults: z.number().optional().default(defaultPageSize),
        cursor: z.string().optional().default(''),
        labelIds: z.array(z.string()).optional().default([]),
        status: z
          .enum([
            // Sender Mode (Sent folder)
            'on_hold',
            'paid',
            'refunded',
            // Receiver Mode (Inbox folder)
            'awaiting_evaluation',
            'approved',
            'attempts_remaining_2',
            'attempts_remaining_1',
            'attempts_remaining_0',
            'attempts_remaining', // Combined filter for all attempts remaining states
          ])
          .optional(),
      }),
    )
    .output(IGetThreadsResponseSchema)
    .query(async ({ ctx, input }) => {
      const { folder, maxResults, cursor, q, labelIds, status } = input;
      const { activeConnection } = ctx;
      const agent = await getZeroAgent(activeConnection.id);
      const userEmail = activeConnection.email;

      console.debug('[listThreads] input:', { folder, maxResults, cursor, q, labelIds });

      if (folder === FOLDERS.DRAFT) {
        console.debug('[listThreads] Listing drafts');
        const drafts = await agent.listDrafts({
          q,
          maxResults,
          pageToken: cursor,
        });
        console.debug('[listThreads] Drafts result:', drafts);
        return drafts;
      }

      type ThreadItem = { id: string; historyId: string | null; $raw?: unknown };

      let threadsResponse: IGetThreadsResponse;

      // Apply folder-to-label mapping when no search query is provided
      const effectiveLabelIds = labelIds;

      if (q) {
        threadsResponse = await agent.rawListThreads({
          query: q,
          maxResults,
          labelIds: effectiveLabelIds,
          pageToken: cursor,
          folder,
        });
      } else {
        // For inbox, prioritize fetching from Gmail directly to avoid database sync issues
        // For other folders, try database first, then fall back to Gmail
        const shouldUseRawList = folder === 'inbox';

        if (shouldUseRawList) {
          // For inbox, always fetch directly from Gmail to ensure we get all emails
          console.debug('[listThreads] Using rawListThreads for inbox folder');
          try {
            threadsResponse = await agent.rawListThreads({
              folder,
              maxResults,
              labelIds: effectiveLabelIds,
              pageToken: cursor,
            });

            console.debug('[listThreads] rawListThreads result (inbox):', {
              folder,
              threadCount: threadsResponse.threads?.length ?? 0,
              hasNextPage: !!threadsResponse.nextPageToken,
              connectionId: activeConnection.id,
              email: activeConnection.email,
            });
          } catch (error: any) {
            // If rate limited, try database as fallback
            if (error?.message?.includes('rate limit') || error?.code === 429) {
              console.warn('[listThreads] Rate limited, trying database fallback:', error.message);
              try {
                threadsResponse = await agent.listThreads({
                  folder,
                  maxResults,
                  labelIds: effectiveLabelIds,
                  pageToken: cursor,
                });
              } catch (dbError) {
                console.error('[listThreads] Both rawListThreads and database failed:', dbError);
                throw error; // Throw original rate limit error
              }
            } else {
              throw error;
            }
          }
        } else {
          // First try to get threads from the database
          try {
            threadsResponse = await agent.listThreads({
              folder,
              // query: q,
              maxResults,
              labelIds: effectiveLabelIds,
              pageToken: cursor,
            });

            console.debug('[listThreads] Database query result:', {
              folder,
              threadCount: threadsResponse.threads?.length ?? 0,
              hasNextPage: !!threadsResponse.nextPageToken,
              connectionId: activeConnection.id,
              email: activeConnection.email,
            });

            // If database is empty, fall back to fetching directly from the provider
            // This handles cases where the database hasn't been synced yet
            if (!threadsResponse.threads || threadsResponse.threads.length === 0) {
              console.debug('[listThreads] Database empty, falling back to rawListThreads for folder:', folder);
              threadsResponse = await agent.rawListThreads({
                folder,
                maxResults,
                labelIds: effectiveLabelIds,
                pageToken: cursor,
              });

              console.debug('[listThreads] rawListThreads result:', {
                folder,
                threadCount: threadsResponse.threads?.length ?? 0,
                hasNextPage: !!threadsResponse.nextPageToken,
                connectionId: activeConnection.id,
                email: activeConnection.email,
              });
            }
          } catch (error) {
            // If database query fails, fall back to fetching directly from the provider
            console.warn('[listThreads] Database query failed, falling back to rawListThreads:', error);
            threadsResponse = await agent.rawListThreads({
              folder,
              maxResults,
              labelIds: effectiveLabelIds,
              pageToken: cursor,
            });

            console.debug('[listThreads] rawListThreads result (after error):', {
              folder,
              threadCount: threadsResponse.threads?.length ?? 0,
              hasNextPage: !!threadsResponse.nextPageToken,
              connectionId: activeConnection.id,
              email: activeConnection.email,
            });
          }
        }
      }

      if (folder === FOLDERS.SNOOZED) {
        const nowTs = Date.now();
        const filtered: ThreadItem[] = [];

        console.debug('[listThreads] Filtering snoozed threads at', new Date(nowTs).toISOString());

        await Promise.all(
          threadsResponse.threads.map(async (t: ThreadItem) => {
            const keyName = `${t.id}__${activeConnection.id}`;
            try {
              const wakeAtIso = await env.snoozed_emails.get(keyName);
              if (!wakeAtIso) {
                filtered.push(t);
                return;
              }

              const wakeAt = new Date(wakeAtIso).getTime();
              if (wakeAt > nowTs) {
                filtered.push(t);
                return;
              }

              console.debug('[UNSNOOZE_ON_ACCESS] Expired thread', t.id, {
                wakeAtIso,
                now: new Date(nowTs).toISOString(),
              });

              await agent.modifyLabels([t.id], ['INBOX'], ['SNOOZED']);
              await env.snoozed_emails.delete(keyName);
            } catch (error) {
              console.error('[UNSNOOZE_ON_ACCESS] Failed for', t.id, error);
              filtered.push(t);
            }
          }),
        );

        threadsResponse.threads = filtered;
        console.debug('[listThreads] Snoozed threads after filtering:', filtered);
      }

      // Filter by status if status filter is provided
      if (status && (folder === FOLDERS.SENT || folder === FOLDERS.INBOX || !folder)) {
        console.debug('[listThreads] Filtering by status:', status);
        const filtered: ThreadItem[] = [];

        // Fetch thread data for each thread to calculate status
        // This is done in parallel for better performance
        await Promise.all(
          threadsResponse.threads.map(async (t: ThreadItem) => {
            try {
              // Get thread data to calculate status
              const threadData = await agent.getThread(t.id, false);
              if (!threadData?.messages) {
                // If we can't get thread data, exclude it from status filtering
                return;
              }

              // Calculate status for this thread
              const threadStatus = getEmailStatus(
                threadData.messages,
                folder || 'inbox',
                userEmail,
                undefined, // escrowStatus - would come from blockchain/evaluation service
                undefined, // aiEvaluationResult - would come from evaluation service
              );

              // Include thread if status matches filter
              // Handle combined "attempts_remaining" filter
              if (status === 'attempts_remaining') {
                if (threadStatus === 'attempts_remaining_2' ||
                  threadStatus === 'attempts_remaining_1' ||
                  threadStatus === 'attempts_remaining_0') {
                  filtered.push(t);
                }
              } else if (threadStatus === status) {
                filtered.push(t);
              }
            } catch (error) {
              // If we can't get thread data, exclude it from results
              console.debug('[listThreads] Failed to get thread data for status filtering:', t.id, error);
            }
          }),
        );

        threadsResponse.threads = filtered;
        console.debug('[listThreads] Status filtered threads:', {
          originalCount: threadsResponse.threads.length,
          filteredCount: filtered.length,
          status,
        });
      }

      console.debug('[listThreads] Returning threadsResponse:', threadsResponse);
      return threadsResponse;
    }),
  markAsRead: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { activeConnection } = ctx;
      const agent = await getZeroAgent(activeConnection.id);
      return agent.markAsRead(input.ids);
    }),
  markAsUnread: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { activeConnection } = ctx;
      const agent = await getZeroAgent(activeConnection.id);
      return agent.markAsUnread(input.ids);
    }),
  markAsImportant: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { activeConnection } = ctx;
      const agent = await getZeroAgent(activeConnection.id);
      return agent.modifyLabels(input.ids, ['IMPORTANT'], []);
    }),
  modifyLabels: activeDriverProcedure
    .input(
      z.object({
        threadId: z.string().array(),
        addLabels: z.string().array().optional().default([]),
        removeLabels: z.string().array().optional().default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { activeConnection } = ctx;
      const agent = await getZeroAgent(activeConnection.id);
      const { threadId, addLabels, removeLabels } = input;

      console.log(`Server: updateThreadLabels called for thread ${threadId}`);
      console.log(`Adding labels: ${addLabels.join(', ')}`);
      console.log(`Removing labels: ${removeLabels.join(', ')}`);

      const result = await agent.normalizeIds(threadId);
      const { threadIds } = result;

      if (threadIds.length) {
        await agent.modifyLabels(threadIds, addLabels, removeLabels);
        return { success: true };
      }

      console.log('Server: No label changes specified');
      return { success: false, error: 'No label changes specified' };
    }),

  toggleStar: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { activeConnection } = ctx;
      const executionCtx = getContext<HonoContext>().executionCtx;
      const agent = await getZeroClient(activeConnection.id, executionCtx);
      const { threadIds } = await agent.normalizeIds(input.ids);

      if (!threadIds.length) {
        return { success: false, error: 'No thread IDs provided' };
      }

      const threadResults: PromiseSettledResult<{ messages: { tags: { name: string }[] }[] }>[] =
        await Promise.allSettled(threadIds.map((id) => agent.getThread(id)));

      let anyStarred = false;
      let processedThreads = 0;

      for (const result of threadResults) {
        if (result.status === 'fulfilled' && result.value && result.value.messages.length > 0) {
          processedThreads++;
          const isThreadStarred = result.value.messages.some((message) =>
            message.tags?.some((tag) => tag.name.toLowerCase().startsWith('starred')),
          );
          if (isThreadStarred) {
            anyStarred = true;
            break;
          }
        }
      }

      const shouldStar = processedThreads > 0 && !anyStarred;

      await agent.modifyLabels(
        threadIds,
        shouldStar ? ['STARRED'] : [],
        shouldStar ? [] : ['STARRED'],
      );

      return { success: true };
    }),
  toggleImportant: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { activeConnection } = ctx;
      const executionCtx = getContext<HonoContext>().executionCtx;
      const agent = await getZeroClient(activeConnection.id, executionCtx);
      const { threadIds } = await agent.normalizeIds(input.ids);

      if (!threadIds.length) {
        return { success: false, error: 'No thread IDs provided' };
      }

      const threadResults: PromiseSettledResult<{ messages: { tags: { name: string }[] }[] }>[] =
        await Promise.allSettled(threadIds.map((id) => agent.getThread(id)));

      let anyImportant = false;
      let processedThreads = 0;

      for (const result of threadResults) {
        if (result.status === 'fulfilled' && result.value && result.value.messages.length > 0) {
          processedThreads++;
          const isThreadImportant = result.value.messages.some((message) =>
            message.tags?.some((tag) => tag.name.toLowerCase().startsWith('important')),
          );
          if (isThreadImportant) {
            anyImportant = true;
            break;
          }
        }
      }

      const shouldMarkImportant = processedThreads > 0 && !anyImportant;

      await agent.modifyLabels(
        threadIds,
        shouldMarkImportant ? ['IMPORTANT'] : [],
        shouldMarkImportant ? [] : ['IMPORTANT'],
      );

      return { success: true };
    }),
  bulkStar: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { activeConnection } = ctx;
      const agent = await getZeroAgent(activeConnection.id);
      return agent.modifyLabels(input.ids, ['STARRED'], []);
    }),
  bulkMarkImportant: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { activeConnection } = ctx;
      const agent = await getZeroAgent(activeConnection.id);
      return agent.modifyLabels(input.ids, ['IMPORTANT'], []);
    }),
  bulkUnstar: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { activeConnection } = ctx;
      const agent = await getZeroAgent(activeConnection.id);
      return agent.modifyLabels(input.ids, [], ['STARRED']);
    }),
  deleteAllSpam: activeDriverProcedure.mutation(async ({ ctx }): Promise<DeleteAllSpamResponse> => {
    const { activeConnection } = ctx;
    const agent = await getZeroAgent(activeConnection.id);
    try {
      return await agent.deleteAllSpam();
    } catch (error) {
      console.error('Error deleting spam emails:', error);
      return {
        success: false,
        message: 'Failed to delete spam emails',
        error: String(error),
        count: 0,
      };
    }
  }),
  bulkUnmarkImportant: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { activeConnection } = ctx;
      const agent = await getZeroAgent(activeConnection.id);
      return agent.modifyLabels(input.ids, [], ['IMPORTANT']);
    }),

  send: activeDriverProcedure
    .input(
      z.object({
        to: z.array(senderSchema),
        subject: z.string(),
        message: z.string(),
        attachments: z.array(serializedFileSchema).optional().default([]),
        headers: z.record(z.string()).optional().default({}),
        cc: z.array(senderSchema).optional(),
        bcc: z.array(senderSchema).optional(),
        threadId: z.string().optional(),
        fromEmail: z.string().optional(),
        draftId: z.string().optional(),
        isForward: z.boolean().optional(),
        originalMessage: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { activeConnection } = ctx;
      const agent = await getZeroAgent(activeConnection.id);
      const { draftId, ...mail } = input;

      // Check if this is a reply with escrow headers (for tracking)
      const escrowThreadId = input.headers?.['X-Solmail-Thread-Id'] ||
        input.headers?.['x-solmail-thread-id'];
      const escrowSenderPubkey = input.headers?.['X-Solmail-Sender-Pubkey'] ||
        input.headers?.['x-solmail-sender-pubkey'];

      if (escrowThreadId && escrowSenderPubkey && !input.isForward) {
        console.log('[ESCROW MONITOR] Reply detected with escrow headers:', {
          threadId: escrowThreadId,
          senderPubkey: escrowSenderPubkey,
          subject: input.subject,
        });
        // Note: Actual claiming happens client-side with wallet signature
        // This is just for logging and tracking
      }

      if (draftId) {
        await agent.sendDraft(draftId, mail);
      } else {
        await agent.create(input);
      }

      // Trigger escrow agent for email replies (async, non-blocking)
      // Note: This processes the sent email. For recipient replies, see workflow integration.
      ctx.c.executionCtx.waitUntil(
        (async () => {
          try {
            // Only process if this is a reply (has threadId and is not a forward)
            if (input.threadId && !input.isForward) {
              const { processEmailReply } = await import('../agent/escrow-agent');
              const msgId = input.threadId || crypto.randomUUID();

              // Get the full thread to access the original email
              const executionCtx = getContext<HonoContext>().executionCtx;
              const agent = await getZeroClient(activeConnection.id, executionCtx);
              const thread = await agent.getThread(input.threadId, true);

              // Find the original email (first message without inReplyTo, or first in array)
              const originalEmail = thread.messages.find(msg => !msg.inReplyTo)
                || thread.messages[0];

              const originalEmailContent = originalEmail?.decodedBody || originalEmail?.body || '';

              // Process email reply with streaming callbacks
              await processEmailReply({
                emailContent: input.message,
                originalEmailContent: originalEmailContent,
                msgId,
                streamCallback: (step: string, data?: any) => {
                  console.log(`[EscrowAgent] ${step}`, data || '');
                },
              });
            }
          } catch (error) {
            console.error('[EscrowAgent] Error processing email reply:', error);
            // Don't block email sending if agent fails
          }
        })()
      );

      return { success: true };
    }),
  delete: activeDriverProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { activeConnection } = ctx;
      const agent = await getZeroAgent(activeConnection.id);
      return agent.delete(input.id);
    }),
  bulkDelete: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { activeConnection } = ctx;
      const agent = await getZeroAgent(activeConnection.id);
      return agent.modifyLabels(input.ids, ['TRASH'], []);
    }),
  bulkArchive: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { activeConnection } = ctx;
      const agent = await getZeroAgent(activeConnection.id);
      return agent.modifyLabels(input.ids, [], ['INBOX']);
    }),
  bulkMute: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { activeConnection } = ctx;
      const agent = await getZeroAgent(activeConnection.id);
      return agent.modifyLabels(input.ids, ['MUTE'], []);
    }),
  getEmailAliases: activeDriverProcedure.query(async ({ ctx }) => {
    const { activeConnection } = ctx;
    const agent = await getZeroAgent(activeConnection.id);
    return agent.getEmailAliases();
  }),
  snoozeThreads: activeDriverProcedure
    .input(
      z.object({
        ids: z.string().array(),
        wakeAt: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { activeConnection } = ctx;
      const agent = await getZeroAgent(activeConnection.id);

      if (!input.ids.length) {
        return { success: false, error: 'No thread IDs provided' };
      }

      const wakeAtDate = new Date(input.wakeAt);
      if (wakeAtDate <= new Date()) {
        return { success: false, error: 'Snooze time must be in the future' };
      }

      await agent.modifyLabels(input.ids, ['SNOOZED'], ['INBOX']);

      const wakeAtIso = wakeAtDate.toISOString();
      await Promise.all(
        input.ids.map((threadId) =>
          env.snoozed_emails.put(`${threadId}__${activeConnection.id}`, wakeAtIso, {
            metadata: { wakeAt: wakeAtIso },
          }),
        ),
      );

      return { success: true };
    }),
  unsnoozeThreads: activeDriverProcedure
    .input(
      z.object({
        ids: z.array(z.string().min(1)).nonempty(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { activeConnection } = ctx;
      const agent = await getZeroAgent(activeConnection.id);
      if (!input.ids.length) return { success: false, error: 'No thread IDs' };
      await agent.modifyLabels(input.ids, ['INBOX'], ['SNOOZED']);

      await Promise.all(
        input.ids.map((threadId) =>
          env.snoozed_emails.delete(`${threadId}__${activeConnection.id}`),
        ),
      );
      return { success: true };
    }),
  getMessageAttachments: activeDriverProcedure
    .input(
      z.object({
        messageId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { activeConnection } = ctx;
      const agent = await getZeroAgent(activeConnection.id);
      return agent.getMessageAttachments(input.messageId) as Promise<
        {
          filename: string;
          mimeType: string;
          size: number;
          attachmentId: string;
          headers: {
            name: string;
            value: string;
          }[];
          body: string;
        }[]
      >;
    }),
  processEmailContent: privateProcedure
    .input(
      z.object({
        html: z.string(),
        shouldLoadImages: z.boolean(),
        theme: z.enum(['light', 'dark']),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const { processedHtml, hasBlockedImages } = processEmailHtml({
          html: input.html,
          shouldLoadImages: input.shouldLoadImages,
          theme: input.theme,
        });

        return {
          processedHtml,
          hasBlockedImages,
        };
      } catch (error) {
        console.error('Error processing email content:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to process email content',
        });
      }
    }),
  scoreEmailProgress: activeDriverProcedure
    .input(
      z.object({
        requestId: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const progress = scoringProgressCache.get(input.requestId);
      if (!progress) {
        return {
          step: 'reading_input' as const,
          data: null,
          completed: false,
        };
      }
      return progress;
    }),
  scoreEmail: activeDriverProcedure
    .input(
      z.object({
        replyContent: z.string().describe('The plaintext reply email content to score'),
        threadEmails: z
          .array(
            z.object({
              decodedBody: z.string().optional(),
              subject: z.string().optional(),
            }),
          )
          .optional()
          .describe('Array of emails in the thread for context'),
        requestId: z.string().optional().describe('Optional request ID for progress tracking'),
      }),
    )
    .mutation(async ({ input }) => {
      // Generate requestId if not provided
      const requestId = input.requestId || `score-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      try {
        // Initialize progress
        scoringProgressCache.set(requestId, {
          step: 'reading_input',
          completed: false,
        });

        // Combine thread emails into a single context string
        const originalEmailContent = input.threadEmails
          ?.map((email) => {
            const body = email.decodedBody || '';
            const subject = email.subject || '';
            return subject ? `Subject: ${subject}\n\n${body}` : body;
          })
          .join('\n\n---\n\n') || undefined;

        // Progress callback
        const progressCallback: ScoringProgressCallback = (step, data) => {
          scoringProgressCache.set(requestId, {
            step,
            data,
            completed: false,
          });
        };

        // Score the email with progress tracking
        const scoringResult = await scoreEmail(
          input.replyContent,
          originalEmailContent,
          progressCallback
        );
        const score = scoringResult.score;
        const recommendations = scoringResult.recommendations || [];

        // Make decision based on score
        const decision = decide(score);

        // Mark as completed
        scoringProgressCache.set(requestId, {
          step: 'completed',
          completed: true,
          result: {
            score,
            recommendations,
            decision,
          },
        });

        // Clean up after 30 seconds
        setTimeout(() => {
          scoringProgressCache.delete(requestId);
        }, 30 * 1000);

        return {
          requestId,
          score,
          recommendations,
          decision,
          success: true,
        };
      } catch (error) {
        console.error('[scoreEmail] Error scoring email:', error);

        // Store error in progress cache
        scoringProgressCache.set(requestId, {
          step: 'completed',
          completed: true,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        // Clean up after 30 seconds
        setTimeout(() => {
          scoringProgressCache.delete(requestId);
        }, 30 * 1000);

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to score email: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }),
});
