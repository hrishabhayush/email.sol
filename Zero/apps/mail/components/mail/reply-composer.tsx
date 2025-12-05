import { constructReplyBody, constructForwardBody } from '@/lib/utils';
import { useActiveConnection } from '@/hooks/use-connections';
import { useEmailAliases } from '@/hooks/use-email-aliases';
import { EmailComposer } from '../create/email-composer';
import { useHotkeysContext } from 'react-hotkeys-hook';
import { useTRPC, trpcClient } from '@/providers/query-provider';
import { useMutation } from '@tanstack/react-query';
import { useSettings } from '@/hooks/use-settings';
import { useThread } from '@/hooks/use-threads';
import { useSession } from '@/lib/auth-client';
import { serializeFiles } from '@/lib/schemas';
import { useDraft } from '@/hooks/use-drafts';
import { m } from '@/paraglide/messages';
import type { Sender } from '@/types';
import { useQueryState } from 'nuqs';
import { useEffect } from 'react';
import posthog from 'posthog-js';
import { toast } from 'sonner';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { createEscrowClient } from '@/lib/escrow-client';

interface ReplyComposeProps {
  messageId?: string;
}

export default function ReplyCompose({ messageId }: ReplyComposeProps) {
  const [mode, setMode] = useQueryState('mode');
  const { enableScope, disableScope } = useHotkeysContext();
  const { data: aliases } = useEmailAliases();

  const [draftId, setDraftId] = useQueryState('draftId');
  const [threadId] = useQueryState('threadId');
  const [, setActiveReplyId] = useQueryState('activeReplyId');
  const { data: emailData, refetch, latestDraft } = useThread(threadId);
  const { data: draft } = useDraft(draftId ?? null);
  const trpc = useTRPC();
  const { mutateAsync: sendEmail } = useMutation(trpc.mail.send.mutationOptions());
  const { data: activeConnection } = useActiveConnection();
  const { data: settings, isLoading: settingsLoading } = useSettings();
  const { data: session } = useSession();

  // Solana wallet hooks for escrow release
  const { wallet, publicKey } = useWallet();
  const { connection } = useConnection();

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

      // Score the email reply BEFORE releasing escrow (only for replies, not forwards)
      let shouldReleaseEscrow = false;
      if (mode === 'reply' && wallet && publicKey && connection && replyToMessage.messageId) {
        try {
          // Extract original email content (prefer decodedBody, fallback to body)
          const originalEmailContent = replyToMessage.decodedBody || replyToMessage.body || '';

          if (!originalEmailContent) {
            console.warn('No original email content available for scoring');
            toast.warning('Cannot score reply: original email content not available. Escrow will not be released.', {
              duration: 5000,
            });
            // Don't return - allow email to be sent, just skip escrow release
          } else {
            toast.loading('Scoring email reply...', { id: 'email-scoring' });

            // Call scoring endpoint
            const scoringResult = await trpcClient.mail.scoreReply.mutate({
              replyContent: data.message,
              originalEmailContent: originalEmailContent,
            });

            toast.dismiss('email-scoring');

            // Check decision
            if (scoringResult.decision === 'WITHHOLD') {
              toast.warning(
                `Email quality score too low (${scoringResult.score}/100). Escrow will not be released, but email will still be sent.`,
                {
                  id: 'escrow-withheld',
                  duration: 7000,
                }
              );
              console.log('📧 Escrow withheld:', {
                score: scoringResult.score,
                decision: scoringResult.decision,
                replyContent: data.message.substring(0, 100) + '...',
              });
              shouldReleaseEscrow = false;
            } else {
              // Score is acceptable, proceed with escrow release
              console.log('📧 Email scored:', {
                score: scoringResult.score,
                decision: scoringResult.decision,
              });
              shouldReleaseEscrow = true;
            }
          }
        } catch (error) {
          console.error('Email scoring error:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          toast.warning(`Email scoring failed: ${errorMessage}. Escrow will not be released, but email will still be sent.`, {
            id: 'email-scoring-error',
            duration: 5000,
          });
          shouldReleaseEscrow = false;
          // Don't return - allow email to be sent, just skip escrow release
        }
      }

      // Only release escrow if decision is RELEASE
      if (shouldReleaseEscrow && mode === 'reply' && wallet && publicKey && connection && replyToMessage.messageId) {
        try {
          // Get sender's wallet address from the original email
          const senderEmail = replyToMessage.sender.email.toLowerCase();
          toast.loading('Looking up sender wallet...', { id: 'wallet-lookup' });

          const senderWalletData = await trpcClient.wallet.getByEmail.query({ email: senderEmail });

          if (!senderWalletData?.walletAddress) {
            console.warn('Sender does not have a wallet address, skipping escrow release');
            toast.dismiss('wallet-lookup');
          } else {
            // Get current user's wallet address
            const recipientWalletData = await trpcClient.wallet.getByEmail.query({ email: userEmail });

            if (!recipientWalletData?.walletAddress) {
              toast.warning('Please set up your wallet address to release escrow. Email will still be sent.', {
                id: 'wallet-lookup',
                duration: 5000,
              });
              // Don't return - allow email to be sent, just skip escrow release
            } else {
              // Get emailId from the original email's headers (stored when escrow was created)
              // If not available, try to reconstruct it deterministically
              let emailId = replyToMessage.escrowEmailId;

              if (!emailId) {
                // Fallback: Reconstruct emailId from original email (same format as when creating escrow)
                // Format: escrow_senderEmail_recipientEmail_subjectHash_timestamp
                const originalSenderEmail = replyToMessage.sender.email.toLowerCase();
                const originalRecipientEmail = userEmail; // Current user was the recipient of the original email
                const subjectHash = Buffer.from(replyToMessage.subject || '').toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);

                // Try to find timestamp from receivedOn date
                const receivedDate = replyToMessage.receivedOn ? new Date(replyToMessage.receivedOn) : null;
                const timestamp = receivedDate ? Math.floor(receivedDate.getTime() / 1000) : Math.floor(Date.now() / 1000);

                // Reconstruct emailId (same format as when creating)
                emailId = `escrow_${originalSenderEmail}_${originalRecipientEmail}_${subjectHash}_${timestamp}`.substring(0, 256);
              }

              if (!emailId) {
                console.warn('Could not get or reconstruct emailId, skipping escrow release');
                toast.dismiss('wallet-lookup');
              } else {
                const senderWallet = new PublicKey(senderWalletData.walletAddress);
                const recipientWallet = new PublicKey(recipientWalletData.walletAddress);

                // Create escrow client and release escrow
                toast.loading('Releasing escrow...', { id: 'escrow-release' });
                const escrowClient = createEscrowClient(connection, wallet);

                toast.loading('Please sign the escrow release transaction...', { id: 'escrow-release' });
                const signature = await escrowClient.releaseEscrow({
                  emailId,
                  sender: senderWallet,
                  recipient: recipientWallet,
                });

                // Log transaction details
                const explorerUrl = `https://solscan.io/tx/${signature}`;
                const solanaExplorerUrl = `https://explorer.solana.com/tx/${signature}?cluster=mainnet-beta`;
                console.log('📧 Escrow Released:', {
                  signature,
                  emailId,
                  sender: senderWallet.toString(),
                  recipient: recipientWallet.toString(),
                  explorer: explorerUrl,
                  solanaExplorer: solanaExplorerUrl,
                });
                console.log(`🔗 View on Solscan: ${explorerUrl}`);
                console.log(`🔗 View on Solana Explorer: ${solanaExplorerUrl}`);

                toast.success('Escrow release transaction sent!', { id: 'escrow-release' });
                toast.loading('Waiting for confirmation...', { id: 'confirmation' });

                // Wait for confirmation
                let confirmed = false;
                let attempts = 0;
                const maxAttempts = 30;

                while (!confirmed && attempts < maxAttempts) {
                  try {
                    const status = await connection.getSignatureStatus(signature);
                    if (
                      status?.value?.confirmationStatus === 'confirmed' ||
                      status?.value?.confirmationStatus === 'finalized'
                    ) {
                      confirmed = true;
                      break;
                    }
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                    attempts++;
                  } catch (error) {
                    console.error('Error checking transaction status:', error);
                    attempts++;
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                  }
                }

                if (!confirmed) {
                  throw new Error('Transaction confirmation timeout. Please check your wallet.');
                }

                toast.success('Escrow released! Sending reply...', { id: 'confirmation' });
              }
            }
          }
        } catch (error) {
          console.error('Escrow release error:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          // Don't block email sending if escrow release fails - the escrow might not exist
          // (e.g., if the email was sent before escrow feature was added)
          if (
            errorMessage.includes('AccountNotInitialized') ||
            errorMessage.includes('not found') ||
            errorMessage.includes('InvalidAccountData')
          ) {
            console.log('Escrow not found for this email, continuing with reply...');
            toast.dismiss('escrow-release');
          } else {
            toast.warning(`Escrow release failed: ${errorMessage}. Email will still be sent.`, {
              id: 'escrow-release',
              duration: 5000,
            });
            // Don't return - allow email to be sent even if escrow release fails
          }
        }
      }

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
        ? '<p style="color: #666; font-size: 12px;">Sent via <a href="https://0.email/" style="color: #0066cc; text-decoration: none;">Zero</a></p>'
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

      await sendEmail({
        to: toRecipients,
        cc: ccRecipients,
        bcc: bccRecipients,
        subject: data.subject,
        message: emailBody,
        attachments: await serializeFiles(data.attachments),
        fromEmail: fromEmail,
        draftId: draftId ?? undefined,
        headers: {
          'In-Reply-To': replyToMessage?.messageId ?? '',
          References: [
            ...(replyToMessage?.references ? replyToMessage.references.split(' ') : []),
            replyToMessage?.messageId,
          ]
            .filter(Boolean)
            .join(' '),
          'Thread-Id': replyToMessage?.threadId ?? '',
        },
        threadId: replyToMessage?.threadId,
        isForward: mode === 'forward',
        originalMessage: replyToMessage.decodedBody,
      });

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

  if (!mode || !emailData) return null;

  return (
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
  );
}