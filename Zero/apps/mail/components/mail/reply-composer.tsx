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
import { useEffect, useState } from 'react';
import posthog from 'posthog-js';
import { toast } from 'sonner';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { useEscrowTracker } from '@/hooks/use-escrow-tracker';
import { useSetThreadEvaluation } from '@/components/context/thread-evaluation-context';
import {
  SOLMAIL_ESCROW_PROGRAM_ID,
  REGISTER_AND_CLAIM_DISCRIMINATOR,
  fetchFreshThreadData,
  scoreEmailReply,
  extractEscrowHeadersFromMessages,
  discoverEscrowAccount,
  ensureWalletConnectedForEscrow,
  claimEscrowAccount,
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

  const { data: settings, isLoading: settingsLoading } = useSettings();
  const { data: session } = useSession();

  //for polling progress of scoring
  const [stillScoring, setStillScoring] = useState(true);
  const [scoringResult, setScoringResult] = useState<{ escrowDecision: 'RELEASE' | 'WITHHOLD'; score: number; recommendations: string[] } | null>(null);
  const setThreadEvaluation = useSetThreadEvaluation();

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

  // NOTE: any early return will skip the escrow logic and proceed to send email
  const handleFindAndSettleEscrow = async (opts: {
    replyContent: string;
    isReplyMode: boolean;
  }): Promise<{
    hasEscrowToClaim: boolean;
    threadIdHex: string | undefined;
    senderPubkeyStr: string | undefined;
    emailScore: number | undefined;
    escrowDecision: 'RELEASE' | 'WITHHOLD' | undefined;
    recommendations: string[] | undefined;
  }> => {
    const { replyContent, isReplyMode } = opts;

    const result = {
      hasEscrowToClaim: false,
      threadIdHex: undefined as string | undefined,
      senderPubkeyStr: undefined as string | undefined,
      emailScore: undefined as number | undefined,
      escrowDecision: undefined as 'RELEASE' | 'WITHHOLD' | undefined,
      recommendations: undefined as string[] | undefined,
    };

    // Early return if not in reply mode or no threadId
    if (!isReplyMode || !threadId) {
      return result;
    }

    if (!replyToMessage) {
      return result;
    }

    /* REPLY-ESCROW LOGIC: 1) Fetch Fresh Thread Data */
    const freshEmailData = (await fetchFreshThreadData({
      threadId: threadId,
      queryClient,
      trpc,
      fallbackEmailData: emailData,
    })) as typeof emailData;

    //TOOD: should prob switch scoring & finding escrow order around -- we don't wanna waste API credits if there's no escrow attached
    /* REPLY-ESCROW LOGIC: 2) Score the email reply */

    try {
      const messagesToScore = freshEmailData?.messages || emailData?.messages || [];
      const threadEmails = messagesToScore.map((msg: { decodedBody?: string; subject?: string }) => ({
        decodedBody: msg.decodedBody || '',
        subject: msg.subject || '',
      }));

      const scored = await scoreEmailReply({
        scoreEmail,
        replyContent,
        threadEmails,
      });

      result.escrowDecision = scored.escrowDecision;
      result.emailScore = scored.emailScore;
      result.recommendations = scored.recommendations;

      if ('withhold' in scored && scored.withhold) {
        // withhold escrow payment, but allow email to send
        return result;
      }
    } catch (error) {
      console.error('[EMAIL SCORING] Error scoring email:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('below the threshold') || errorMessage.includes('Email score below threshold')) {
        throw error; //TODO: iron out what throwing does
      }
      toast.error(
        `Failed to score email: ${errorMessage}. Escrow release blocked for safety.`,
        { id: 'email-scoring-error', duration: 10000 }
      );
      throw new Error(`Email scoring failed: ${errorMessage}. Escrow release blocked.`);
    }

    /* REPLY-ESCROW LOGIC: 3) Escrow account discovery */
    const messagesToSearch = freshEmailData?.messages || emailData?.messages || [];
    const { threadIdFromHeaders, senderPubkeyFromHeaders } =
      extractEscrowHeadersFromMessages(messagesToSearch as { headers?: Record<string, string> }[]);

    if (!threadIdFromHeaders || !senderPubkeyFromHeaders) {
      console.log('[SETTLEMENT] No escrow headers found in messages');
      // Early return - no escrow
      return result;
    }

    const discovery = await discoverEscrowAccount({
      connection,
      senderPubkey: new PublicKey(senderPubkeyFromHeaders),
      threadIdFromHeaders,
      programId: SOLMAIL_ESCROW_PROGRAM_ID,
    });
    result.hasEscrowToClaim = discovery.hasEscrowToClaim;
    result.threadIdHex = discovery.threadIdHex;
    result.senderPubkeyStr = discovery.senderPubkeyStr;
    let escrowAccountAddress = discovery.escrowAccountAddress;

    // Return immediately if no escrow, no thread/pubkey/account address
    if (!result.hasEscrowToClaim || !result.threadIdHex || !result.senderPubkeyStr || !escrowAccountAddress) {
      console.warn('[ESCROW LOG] No escrow account found, skipping claim.');
      return result;
    }

    if (!ensureWalletConnectedForEscrow({
      wallet: wallet as WalletLike | null,
      publicKey,
      connection,
    })) {
      throw new Error('Wallet not connected but escrow account found - email send blocked');
    }

    /* REPLY-ESCROW LOGIC 4: Escrow settlement/claiming */
    let claimSuccessful = false;
    try {
      claimSuccessful = await claimEscrowAccount({
        connection,
        wallet: wallet! as WalletLike,
        publicKey: publicKey!,
        threadIdHex: result.threadIdHex!,
        senderPubkeyStr: result.senderPubkeyStr!,
        escrowAccountAddress: escrowAccountAddress!,
        programId: SOLMAIL_ESCROW_PROGRAM_ID,
        discriminator: REGISTER_AND_CLAIM_DISCRIMINATOR,
      });
    } catch (error) {
      console.error('[ESCROW LOG] Error claiming escrow:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Settlement failed: ${errorMessage}`, { id: 'claim', duration: 10000 });
      claimSuccessful = false;
    }

    if (!claimSuccessful && result.hasEscrowToClaim) {
      console.error('[ESCROW LOG] ❌ SETTLEMENT INCOMPLETE - Escrow exists but claim was not successful', {
        threadIdHex: result.threadIdHex!,
        senderPubkeyStr: result.senderPubkeyStr!,
      });
      toast.error('Settlement incomplete. Please retry sending the reply.', {
        id: 'settlement-incomplete',
        duration: 10000,
      });
      throw new Error('Settlement incomplete. Please retry sending the reply to complete the escrow claim.');
    }

    return result;
  };

  const handleSendEmail = async (data: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    message: string;
    attachments: File[];
  }) => {
    if (!replyToMessage || !activeConnection?.email) return;

    let escrowResult: Awaited<ReturnType<typeof handleFindAndSettleEscrow>> | undefined;
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

      /* REPLY-ESCROW LOGIC 0th: Send email */
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

      posthog.capture('Reply Email Sent');

      await refetch();
      toast.success(m['pages.createEmail.emailSent']());

      /* REPLY-ESCROW LOGIC: Find and settle escrow (steps 1-4) */
      const isReplyMode = mode === 'reply' || mode === 'replyAll';
      escrowResult = await handleFindAndSettleEscrow({
        replyContent: data.message,
        isReplyMode,
      });

      // Refetch again after scoring so thread includes our new reply; then get its message id
      // (refetch right after send can return stale data before the new message is in the thread)
      const refetchedAfterScoring = await refetch();
      const messages = refetchedAfterScoring.data?.messages ?? [];
      const nonDraft = messages.filter((m: { isDraft?: boolean }) => !m.isDraft);
      const scoredMessageId =
        nonDraft[nonDraft.length - 1]?.id ?? refetchedAfterScoring.data?.latest?.id;

      setStillScoring(false);
      if (
        threadId &&
        scoredMessageId &&
        escrowResult?.escrowDecision != null &&
        escrowResult?.emailScore != null
      ) {
        setThreadEvaluation(
          threadId,
          scoredMessageId,
          escrowResult.escrowDecision === 'RELEASE'
            ? 'good'
            : escrowResult.emailScore,
          escrowResult.recommendations ?? [],
        );
        setScoringResult({
          escrowDecision: escrowResult.escrowDecision,
          score: escrowResult.emailScore,
          recommendations: escrowResult.recommendations ?? [],
        });
      } else {
        setScoringResult(null);
      }
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error(m['pages.createEmail.failedToSendEmail']());
      setStillScoring(false);
      setScoringResult(null);
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

  return (
    <>
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
