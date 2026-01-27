import { constructReplyBody, constructForwardBody } from '@/lib/utils';
import { useActiveConnection } from '@/hooks/use-connections';
import { useEmailAliases } from '@/hooks/use-email-aliases';
import { EmailComposer } from '../create/email-composer';
import { useHotkeysContext } from 'react-hotkeys-hook';
import { useTRPC } from '@/providers/query-provider';
import { useMutation } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { useSettings } from '@/hooks/use-settings';
import { useThread } from '@/hooks/use-threads';
import { useSession } from '@/lib/auth-client';
import { serializeFiles } from '@/lib/schemas';
import { useDraft } from '@/hooks/use-drafts';
import { m } from '@/paraglide/messages';
import type { Sender } from '@/types';
import { useQueryState } from 'nuqs';
import { useEffect, useState, useRef } from 'react';
import posthog from 'posthog-js';
import { toast } from 'sonner';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { useEscrowTracker } from '@/hooks/use-escrow-tracker';
import { EmailScoringModal } from './email-scoring-modal';
import {
  SOLMAIL_ESCROW_PROGRAM_ID,
  REGISTER_AND_CLAIM_DISCRIMINATOR,
  fetchFreshThreadData,
  scoreEmailReply,
  extractEscrowHeadersFromMessages,
  discoverEscrowAccount,
  ensureWalletConnectedForEscrow,
  checkScoringRelease,
  verifyEscrowData,
  executeEscrowSettlement,
  prepareSendEmailParams,
  type WalletLike,
} from './reply-composer-helper';

interface ReplyComposeProps {
  messageId?: string;
}

export default function ReplyCompose({ messageId }: ReplyComposeProps) {
  const [mode, setMode] = useQueryState('mode');
  const { enableScope, disableScope } = useHotkeysContext();
  const { data: aliases } = useEmailAliases();
  const { wallet, publicKey } = useWallet();
  const { connection } = useConnection();
  const { checkAndClaimEscrow } = useEscrowTracker();

  const [draftId, setDraftId] = useQueryState('draftId');
  const [threadId] = useQueryState('threadId');
  const [, setActiveReplyId] = useQueryState('activeReplyId');
  const { data: emailData, refetch, latestDraft } = useThread(threadId);
  const { data: draft } = useDraft(draftId ?? null);
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutateAsync: sendEmail } = useMutation(trpc.mail.send.mutationOptions());
  const { mutateAsync: scoreEmail } = useMutation(trpc.mail.scoreEmail.mutationOptions());
  const { data: activeConnection } = useActiveConnection();

  // Email scoring modal state
  const [scoringModalOpen, setScoringModalOpen] = useState(false);
  const [scoringRequestId, setScoringRequestId] = useState<string | null>(null);
  const [scoringProgress, setScoringProgress] = useState<'reading_input' | 'calculating_score' | 'creating_recommendations' | 'completed'>('reading_input');
  const [scoringResult, setScoringResult] = useState<{ score: number; recommendations: string[] } | null>(null);
  const progressPollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { data: settings, isLoading: settingsLoading } = useSettings();
  const { data: session } = useSession();

  // Find the specific message to reply to
  const replyToMessage =
    (messageId && emailData?.messages.find((msg) => msg.id === messageId)) || emailData?.latest;

  // Initialize recipients and subject when mode changes
  useEffect(() => {
    if (!replyToMessage || !mode || !activeConnection?.email) return;

    const userEmail = activeConnection.email.toLowerCase();
    const senderEmail = replyToMessage.sender.email.toLowerCase();

    // Set subject based on mode

    if (mode === 'reply') {
      // Reply to sender
      const to: string[] = [];

      // If the sender is not the current user, add them to the recipients
      if (senderEmail !== userEmail) {
        to.push(replyToMessage.sender.email);
      } else if (replyToMessage.to && replyToMessage.to.length > 0 && replyToMessage.to[0]?.email) {
        // If we're replying to our own email, reply to the first recipient
        to.push(replyToMessage.to[0].email);
      }

      // Initialize email composer with these recipients
      // Note: The actual initialization happens in the EmailComposer component
    } else if (mode === 'replyAll') {
      const to: string[] = [];
      const cc: string[] = [];

      // Add original sender if not current user
      if (senderEmail !== userEmail) {
        to.push(replyToMessage.sender.email);
      }

      // Add original recipients from To field
      replyToMessage.to?.forEach((recipient) => {
        const recipientEmail = recipient.email.toLowerCase();
        if (recipientEmail !== userEmail && recipientEmail !== senderEmail) {
          to.push(recipient.email);
        }
      });

      // Add CC recipients
      replyToMessage.cc?.forEach((recipient) => {
        const recipientEmail = recipient.email.toLowerCase();
        if (recipientEmail !== userEmail && !to.includes(recipient.email)) {
          cc.push(recipient.email);
        }
      });

      // Initialize email composer with these recipients
    } else if (mode === 'forward') {
      // For forward, we start with empty recipients
      // Just set the subject and include the original message
    }
  }, [mode, replyToMessage, activeConnection?.email]);

  const handleSendEmail = async (data: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    message: string;
    attachments: File[];
  }) => {
    if (!replyToMessage || !activeConnection?.email) return;

    try {
      const userEmail = activeConnection.email.toLowerCase();
      const userName = activeConnection.name || session?.user?.name || '';

      let fromEmail = userEmail;

      if (aliases && aliases.length > 0 && replyToMessage) {
        const allRecipients = [
          ...(replyToMessage.to || []),
          ...(replyToMessage.cc || []),
          ...(replyToMessage.bcc || []),
        ];
        const matchingAlias = aliases.find((alias) =>
          allRecipients.some(
            (recipient) => recipient.email.toLowerCase() === alias.email.toLowerCase(),
          ),
        );

        if (matchingAlias) {
          fromEmail = userName.trim()
            ? `${userName.replace(/[<>]/g, '')} <${matchingAlias.email}>`
            : matchingAlias.email;
        } else {
          const primaryEmail =
            aliases.find((alias) => alias.primary)?.email || aliases[0]?.email || userEmail;
          fromEmail = userName.trim()
            ? `${userName.replace(/[<>]/g, '')} <${primaryEmail}>`
            : primaryEmail;
        }
      }

      const toRecipients: Sender[] = data.to.map((email) => ({
        email,
        name: email.split('@')[0] || 'User',
      }));

      const ccRecipients: Sender[] | undefined = data.cc
        ? data.cc.map((email) => ({
          email,
          name: email.split('@')[0] || 'User',
        }))
        : undefined;

      const bccRecipients: Sender[] | undefined = data.bcc
        ? data.bcc.map((email) => ({
          email,
          name: email.split('@')[0] || 'User',
        }))
        : undefined;

      const zeroSignature = settings?.settings.zeroSignature
        ? '<p style="color: #666; font-size: 12px;">Sent via <a href="https://solmail.app/" style="color: #0066cc; text-decoration: none;">Solmail</a></p>'
        : '';

      const emailBody =
        mode === 'forward'
          ? constructForwardBody(
            data.message + zeroSignature,
            new Date(replyToMessage.receivedOn || '').toLocaleString(),
            { ...replyToMessage.sender, subject: replyToMessage.subject },
            toRecipients,
            //   replyToMessage.decodedBody,
          )
          : constructReplyBody(
            data.message + zeroSignature,
            new Date(replyToMessage.receivedOn || '').toLocaleString(),
            replyToMessage.sender,
            toRecipients,
            //   replyToMessage.decodedBody,
          );

      /* REPLY-ESCROW LOGIC 1: Fetch Fresh Thread Data */
      const isReplyMode = mode === 'reply' || mode === 'replyAll';
      let hasEscrowToClaim = false;
      let threadIdHex: string | undefined;
      let senderPubkeyStr: string | undefined;
      let escrowAccountAddress: string | undefined;

      const freshEmailData = (await fetchFreshThreadData({
        threadId: isReplyMode && threadId ? threadId : null,
        queryClient,
        trpc,
        fallbackEmailData: emailData,
      })) as typeof emailData;

      /* REPLY-ESCROW LOGIC 2: Score the email reply */
      let emailScore: number | undefined;
      let escrowDecision: 'RELEASE' | 'WITHHOLD' | undefined;

      if (isReplyMode) {
        try {
          const messagesToScore = freshEmailData?.messages || emailData?.messages || [];
          const threadEmails = messagesToScore.map((msg: { decodedBody?: string; subject?: string }) => ({
            decodedBody: msg.decodedBody || '',
            subject: msg.subject || '',
          }));

          const result = await scoreEmailReply({
            queryClient,
            trpc,
            scoreEmail,
            replyContent: data.message,
            threadEmails,
            progressPollIntervalRef,
            setScoringRequestId,
            setScoringProgress,
            setScoringResult,
            setScoringModalOpen,
          });

          emailScore = result.emailScore;
          escrowDecision = result.escrowDecision;

          if ('withhold' in result && result.withhold) {
            return;
          }
        } catch (error) {
          if (progressPollIntervalRef.current) {
            clearInterval(progressPollIntervalRef.current);
            progressPollIntervalRef.current = null;
          }
          console.error('[EMAIL SCORING] Error scoring email:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          if (errorMessage.includes('below the threshold')) {
            return;
          }
          setScoringModalOpen(false);
          toast.error(
            `Failed to score email: ${errorMessage}. Escrow release blocked for safety.`,
            { id: 'email-scoring-error', duration: 10000 }
          );
          throw new Error(`Email scoring failed: ${errorMessage}. Escrow release blocked.`);
        }
      }

      /* REPLY-ESCROW LOGIC 3: Escrow account discovery (a–e) */
      if (isReplyMode && replyToMessage) {
        const messagesToSearch = freshEmailData?.messages || emailData?.messages || [];
        const { threadIdFromHeaders, senderPubkeyFromHeaders } =
          extractEscrowHeadersFromMessages(messagesToSearch as { headers?: Record<string, string> }[]);

        if (!threadIdFromHeaders || !senderPubkeyFromHeaders) {
          console.log('[SETTLEMENT] No escrow headers found in messages');
        } else {
          const discovery = await discoverEscrowAccount({
            connection,
            senderPubkey: new PublicKey(senderPubkeyFromHeaders),
            threadIdFromHeaders,
            programId: SOLMAIL_ESCROW_PROGRAM_ID,
          });
          hasEscrowToClaim = discovery.hasEscrowToClaim;
          threadIdHex = discovery.threadIdHex;
          senderPubkeyStr = discovery.senderPubkeyStr;
          escrowAccountAddress = discovery.escrowAccountAddress;
        }

        if (!ensureWalletConnectedForEscrow({
          hasEscrowToClaim,
          wallet: wallet as WalletLike | null,
          publicKey,
          connection,
        })) {
          return;
        }

        /* REPLY-ESCROW LOGIC 4: Escrow settlement/claiming (a–g) */
        if (!checkScoringRelease({ escrowDecision, emailScore })) {
          /* still allow email to send */
        } else {
          let claimSuccessful = false;
          try {
            if (!threadIdHex || !senderPubkeyStr) {
              console.warn('⚠️ No thread_id or sender pubkey, cannot claim escrow');
            } else if (!escrowAccountAddress) {
              console.warn('[ESCROW LOG] Escrow account not found, skipping claim:', {
                timestamp: new Date().toISOString(),
                subject: replyToMessage.subject,
                messageId: replyToMessage.id,
              });
              toast.info('Escrow claim skipped: escrow account not found', { id: 'claim' });
            } else {
              verifyEscrowData(threadIdHex, senderPubkeyStr);
              claimSuccessful = await executeEscrowSettlement({
                connection,
                wallet: wallet! as WalletLike,
                publicKey: publicKey!,
                threadIdHex,
                senderPubkeyStr,
                escrowAccountAddress,
                programId: SOLMAIL_ESCROW_PROGRAM_ID,
                discriminator: REGISTER_AND_CLAIM_DISCRIMINATOR,
              });
            }
          } catch (error) {
            console.error('[ESCROW LOG] Error claiming escrow:', {
              timestamp: new Date().toISOString(),
              error: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
              subject: replyToMessage.subject,
              messageId: replyToMessage.id,
              threadIdHex,
              senderPubkeyStr,
            });
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            toast.error(`❌ Settlement failed: ${errorMessage}`, { id: 'claim', duration: 10000 });

            if (hasEscrowToClaim) {
              console.error('[ESCROW LOG] ❌ SETTLEMENT FAILED - Blocking email send until settlement succeeds', {
                error: errorMessage,
                threadIdHex,
                senderPubkeyStr,
              });
              toast.error(`Settlement failed. Please retry. Error: ${errorMessage}`, {
                id: 'settlement-failed',
                duration: 15000,
                action: { label: 'Retry', onClick: () => console.log('[ESCROW LOG] User requested retry') },
              });
              throw new Error(
                `Settlement failed: ${errorMessage}. Please ensure your wallet is connected and has sufficient balance for transaction fees.`
              );
            }
            console.warn('[ESCROW LOG] No escrow to claim, proceeding with email send');
          }

          if (!claimSuccessful && hasEscrowToClaim) {
            console.error('[ESCROW LOG] ❌ SETTLEMENT INCOMPLETE - Escrow exists but claim was not successful', {
              threadIdHex,
              senderPubkeyStr,
            });
            toast.error('Settlement incomplete. Please retry sending the reply.', {
              id: 'settlement-incomplete',
              duration: 10000,
            });
            throw new Error('Settlement incomplete. Please retry sending the reply to complete the escrow claim.');
          }
        }

        if (hasEscrowToClaim) {
          console.warn('[SETTLEMENT] Escrow found but wallet not connected - email send blocked');
        } else {
          console.log('[SETTLEMENT] No escrow to claim - proceeding with email send');
        }
      }


      /* REPLY-ESCROW LOGIC 5: Send email */
      const sendParams = prepareSendEmailParams({
        toRecipients,
        ccRecipients,
        bccRecipients,
        subject: data.subject,
        emailBody,
        attachments: await serializeFiles(data.attachments),
        fromEmail,
        draftId: draftId ?? undefined,
        replyToMessage: replyToMessage!,
        isForward: mode === 'forward',
      });
      await sendEmail(sendParams);

      // After email is sent, if escrow headers were found but claim wasn't successful, try auto-claim
      if (isReplyMode && hasEscrowToClaim && threadIdHex && senderPubkeyStr && wallet && publicKey) {
        // Give it a moment for the email to be sent, then try automatic claim
        setTimeout(async () => {
          //console.log('[ESCROW LOG] Attempting automatic escrow claim after email send');
          const claimed = await checkAndClaimEscrow(senderPubkeyStr, threadIdHex);
          if (claimed) {
            console.log('[ESCROW LOG] ✅ Automatic escrow claim successful after email send');
          } else {
            console.warn('[ESCROW LOG] ⚠️ Automatic escrow claim failed, user may need to claim manually');
          }
        }, 2000);
      }

      posthog.capture('Reply Email Sent');

      // Reset states
      setMode(null);
      await refetch();
      toast.success(m['pages.createEmail.emailSent']());
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error(m['pages.createEmail.failedToSendEmail']());
    }
  };

  useEffect(() => {
    if (mode) {
      enableScope('compose');
    } else {
      disableScope('compose');
    }
    return () => {
      disableScope('compose');
    };
  }, [mode, enableScope, disableScope]);

  const ensureEmailArray = (emails: string | string[] | undefined | null): string[] => {
    if (!emails) return [];
    if (Array.isArray(emails)) {
      return emails.map((email) => email.trim().replace(/[<>]/g, ''));
    }
    if (typeof emails === 'string') {
      return emails
        .split(',')
        .map((email) => email.trim())
        .filter((email) => email.length > 0)
        .map((email) => email.replace(/[<>]/g, ''));
    }
    return [];
  };

  // Handle modal close - if score was below threshold, we've already blocked email send
  const handleModalClose = (open: boolean) => {
    setScoringModalOpen(open);
    // If closing and we have a result with score < 70, the email send was already blocked
    // No need to do anything else here
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (progressPollIntervalRef.current) {
        clearInterval(progressPollIntervalRef.current);
      }
    };
  }, []);

  if (!mode || !emailData) return null;

  return (
    <>
      <EmailScoringModal
        open={scoringModalOpen}
        onOpenChange={handleModalClose}
        progressStep={scoringProgress}
        score={scoringResult?.score}
        recommendations={scoringResult?.recommendations}
        onOk={() => handleModalClose(false)}
      />
      <div className="w-full rounded-2xl overflow-visible border">
        <EmailComposer
          editorClassName="min-h-[50px]"
          className="w-full max-w-none! pb-1 overflow-visible"
          onSendEmail={handleSendEmail}
          onClose={async () => {
            setMode(null);
            setDraftId(null);
            setActiveReplyId(null);
          }}
          initialMessage={draft?.content ?? latestDraft?.decodedBody}
          initialTo={ensureEmailArray(draft?.to)}
          initialCc={ensureEmailArray(draft?.cc)}
          initialBcc={ensureEmailArray(draft?.bcc)}
          initialSubject={draft?.subject}
          autofocus={true}
          settingsLoading={settingsLoading}
          replyingTo={replyToMessage?.sender.email}
        />
      </div>
    </>
  );
}
