import { constructReplyBody, constructForwardBody } from '@/lib/utils';
import { useActiveConnection } from '@/hooks/use-connections';
import { useEmailAliases } from '@/hooks/use-email-aliases';
import { EmailComposer } from '../create/email-composer';
import { useHotkeysContext } from 'react-hotkeys-hook';
import { useTRPC } from '@/providers/query-provider';
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
import { Connection, PublicKey, Transaction, TransactionInstruction, SystemProgram } from '@solana/web3.js';
import { useEscrowTracker } from '@/hooks/use-escrow-tracker';

// SolMail Escrow program configuration
const SOLMAIL_ESCROW_PROGRAM_ID = new PublicKey('Cx6XKyjVT5oipy3gdko2A7R4oJYc5ENUqgMapBF7zxkb');
const REGISTER_AND_CLAIM_DISCRIMINATOR = Uint8Array.from([127, 144, 210, 98, 66, 165, 255, 139]);

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
  const { mutateAsync: sendEmail } = useMutation(trpc.mail.send.mutationOptions());
  const { data: activeConnection } = useActiveConnection();
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

      // Try to claim escrow if wallet is connected and this is a reply (not forward)
      const isReplyMode = mode === 'reply' || mode === 'replyAll';
      
      // Declare escrow variables outside the if block so they're accessible later
      let hasEscrowToClaim = false;
      let threadIdHex: string | undefined;
      let senderPubkeyStr: string | undefined;
      let escrowAccountAddress: string | undefined; // Direct address from transaction, no PDA derivation needed
      
      // CRITICAL: Force fresh fetch of thread data to get latest escrow headers
      // This bypasses cache and gets data directly from Gmail API
      let freshEmailData = emailData;
      if (isReplyMode && threadId) {
        console.log('[ESCROW LOG] Force fetching fresh thread data from Gmail API (bypassing cache):', {
          threadId,
          mode,
        });
        try {
          // Fetch directly with forceFresh=true to bypass cache
          // Use try-catch to handle TRPC errors gracefully
          const freshData = await trpc.mail.get.query({ id: threadId, forceFresh: true }).catch((err) => {
            console.warn('[ESCROW LOG] TRPC query failed, will use cached data:', err);
            return null;
          });
          if (freshData) {
            freshEmailData = freshData;
            console.log('[ESCROW LOG] Fresh thread data fetched:', {
              threadId,
              messageCount: freshData?.messages?.length || 0,
              hasHeaders: freshData?.messages?.some((m: any) => {
                const h = m.headers || {};
                return !!(h['X-Solmail-Thread-Id'] || h['x-solmail-thread-id']);
              }),
            });
          } else {
            console.log('[ESCROW LOG] Using cached email data for escrow header search');
          }
        } catch (error) {
          console.error('[ESCROW LOG] Failed to fetch fresh thread data, using cached:', error);
          // Continue with cached data if fresh fetch fails
        }
      }
      
      console.log('🔍 Reply escrow claim check:', {
        mode,
        isReplyMode,
        hasWallet: !!wallet,
        hasPublicKey: !!publicKey,
        hasConnection: !!connection,
        hasAdapter: !!wallet?.adapter,
        hasReplyToMessage: !!replyToMessage,
        replyToMessageKeys: replyToMessage ? Object.keys(replyToMessage) : [],
      });

      if (isReplyMode && replyToMessage) {
        // NEW APPROACH: Get escrow account from program by checking sender's recent transactions
        // Then initiate transaction directly to receiver
        
        console.log('🔍 [SETTLEMENT] Finding escrow account from program:', {
          timestamp: new Date().toISOString(),
          subject: replyToMessage.subject,
          originalSender: replyToMessage.sender?.email,
          threadId: threadId,
        });
        
        // Known sender pubkey
        const KNOWN_SENDER_PUBKEY = '7DUw1493Y2xS9TDvos11sfoPmEwo3UjqryGPdqE44nWW';
        const encoder = new TextEncoder();
        
        // Get the original email (first message in thread)
        const messagesToSearch = freshEmailData?.messages || emailData?.messages || [];
        const originalMessage = messagesToSearch.length > 0 ? messagesToSearch[0] : replyToMessage;
        
        // FIRST: Try to get thread_id and sender pubkey from headers
        let threadIdFromHeaders: string | undefined;
        let senderPubkeyFromHeaders: string | undefined;
        
        // Search through all messages to find escrow headers
        for (const msg of messagesToSearch) {
          const msgHeaders = (msg as any)?.headers || {};
          const foundThreadId = msgHeaders['X-Solmail-Thread-Id'] || 
                               msgHeaders['x-solmail-thread-id'] ||
                               msgHeaders['X-SOLMAIL-THREAD-ID'] ||
                               msgHeaders['X-Solmail-Thread-ID'];
          const foundSenderPubkey = msgHeaders['X-Solmail-Sender-Pubkey'] || 
                                  msgHeaders['x-solmail-sender-pubkey'] ||
                                  msgHeaders['X-SOLMAIL-SENDER-PUBKEY'] ||
                                  msgHeaders['X-Solmail-Sender-PUBKEY'];
          
          if (foundThreadId && foundSenderPubkey) {
            threadIdFromHeaders = foundThreadId;
            senderPubkeyFromHeaders = foundSenderPubkey;
            console.log('✅✅✅ [SETTLEMENT] Found escrow headers in message:', {
              messageId: msg.id,
              subject: msg.subject,
              threadIdHex: foundThreadId,
              senderPubkey: foundSenderPubkey,
            });
            break;
          }
        }
        
        // Use sender pubkey from headers if found, otherwise use known sender pubkey
        const SENDER_PUBKEY_TO_USE = senderPubkeyFromHeaders || KNOWN_SENDER_PUBKEY;
        
        if (senderPubkeyFromHeaders) {
          console.log('✅ [SETTLEMENT] Using sender pubkey from headers:', senderPubkeyFromHeaders);
        } else {
          console.log('✅ [SETTLEMENT] Using known sender pubkey:', KNOWN_SENDER_PUBKEY);
        }
        
        // NEW APPROACH: Get the LATEST transaction from sender and extract escrow account address
        // The escrow account is the account that received funds in the latest transaction
        const senderPubkey = new PublicKey(SENDER_PUBKEY_TO_USE);
        
        console.log('[SETTLEMENT] Fetching LATEST transaction from sender to find escrow account:', {
          senderPubkey: SENDER_PUBKEY_TO_USE,
        });
        
        try {
          // Get the LATEST transaction from the sender (limit: 1)
          const signatures = await connection.getSignaturesForAddress(senderPubkey, { limit: 1 });
          
          if (signatures.length === 0) {
            console.log('[SETTLEMENT] No transactions found from sender');
          } else {
            const latestSig = signatures[0];
            console.log(`[SETTLEMENT] Found latest transaction: ${latestSig.signature}`);
            
            try {
              const tx = await connection.getTransaction(latestSig.signature, {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0,
              });
              
              if (!tx || !tx.meta) {
                console.log('[SETTLEMENT] Could not parse latest transaction');
              } else {
                // Check if this transaction involves the escrow program
                const accountKeys = tx.transaction.message.accountKeys;
                const hasEscrowProgram = accountKeys.some((key: any) => {
                  const pubkey = typeof key === 'string' ? new PublicKey(key) : key.pubkey;
                  return pubkey.equals(SOLMAIL_ESCROW_PROGRAM_ID);
                });
                
                if (!hasEscrowProgram) {
                  console.log('[SETTLEMENT] Latest transaction does not involve escrow program');
                } else {
                  console.log('[SETTLEMENT] Latest transaction involves escrow program, extracting escrow account...');
                  
                  // Look at account balance changes to find which account received funds
                  // The escrow account will have a positive balance change (received funds from sender)
                  if (tx.meta.preBalances && tx.meta.postBalances && accountKeys.length === tx.meta.preBalances.length) {
                    for (let i = 0; i < accountKeys.length; i++) {
                      const accountKey = accountKeys[i];
                      const accountPubkey = typeof accountKey === 'string' 
                        ? new PublicKey(accountKey)
                        : accountKey.pubkey;
                      
                      // Skip sender and program ID
                      if (accountPubkey.equals(senderPubkey) || accountPubkey.equals(SOLMAIL_ESCROW_PROGRAM_ID)) {
                        continue;
                      }
                      
                      const preBalance = tx.meta.preBalances[i];
                      const postBalance = tx.meta.postBalances[i];
                      const balanceChange = postBalance - preBalance;
                      
                      // If this account received funds (positive balance change), it might be the escrow
                      if (balanceChange > 0) {
                        // Check if this account is owned by the escrow program
                        const accountInfo = await connection.getAccountInfo(accountPubkey);
                        if (accountInfo && accountInfo.owner.equals(SOLMAIL_ESCROW_PROGRAM_ID)) {
                          // This is an escrow account! Check if it's pending
                          const data = accountInfo.data;
                          if (data.length >= 138) {
                            const statusByte = data[120];
                            
                            if (statusByte === 0) { // Pending
                              // Extract sender and thread_id from escrow data
                              const senderPubkeyBytes = data.slice(8, 40);
                              const threadIdBytes = data.slice(72, 104);
                              const escrowSenderPubkey = new PublicKey(senderPubkeyBytes);
                              const threadIdHexFromEscrow = Array.from(threadIdBytes).map(b => b.toString(16).padStart(2, '0')).join('');
                              
                              // Verify this escrow belongs to our sender
                              if (escrowSenderPubkey.equals(senderPubkey)) {
                                // Found valid pending escrow account from LATEST transaction!
                                escrowAccountAddress = accountPubkey.toBase58();
                                threadIdHex = threadIdHexFromEscrow;
                                senderPubkeyStr = SENDER_PUBKEY_TO_USE;
                                hasEscrowToClaim = true;
                                
                                console.log('✅✅✅ [SETTLEMENT] Found escrow account from LATEST transaction!', {
                                  escrowAccountAddress,
                                  senderPubkey: SENDER_PUBKEY_TO_USE,
                                  threadIdHex,
                                  escrowBalance: `${accountInfo.lamports / 1_000_000_000} SOL`,
                                  balanceChange: `${balanceChange / 1_000_000_000} SOL`,
                                  transactionSignature: latestSig.signature,
                                  note: 'Will initiate transaction FROM this account TO receiver',
                                });
                                break; // Found it!
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                  
                  // If we didn't find it via balance changes, try checking all accounts owned by escrow program
                  if (!hasEscrowToClaim) {
                    console.log('[SETTLEMENT] Trying alternative method: checking all accounts in transaction...');
                    for (const accountKey of accountKeys) {
                      const accountPubkey = typeof accountKey === 'string' 
                        ? new PublicKey(accountKey)
                        : accountKey.pubkey;
                      
                      // Skip sender and program ID
                      if (accountPubkey.equals(senderPubkey) || accountPubkey.equals(SOLMAIL_ESCROW_PROGRAM_ID)) {
                        continue;
                      }
                      
                      // Check if this account is owned by the escrow program
                      const accountInfo = await connection.getAccountInfo(accountPubkey);
                      if (accountInfo && accountInfo.owner.equals(SOLMAIL_ESCROW_PROGRAM_ID)) {
                        // This is an escrow account! Check if it's pending
                        const data = accountInfo.data;
                        if (data.length >= 138) {
                          const statusByte = data[120];
                          
                          if (statusByte === 0) { // Pending
                            // Extract sender and thread_id from escrow data
                            const senderPubkeyBytes = data.slice(8, 40);
                            const threadIdBytes = data.slice(72, 104);
                            const escrowSenderPubkey = new PublicKey(senderPubkeyBytes);
                            const threadIdHexFromEscrow = Array.from(threadIdBytes).map(b => b.toString(16).padStart(2, '0')).join('');
                            
                            // Verify this escrow belongs to our sender
                            if (escrowSenderPubkey.equals(senderPubkey)) {
                              // Found valid pending escrow account!
                              escrowAccountAddress = accountPubkey.toBase58();
                              threadIdHex = threadIdHexFromEscrow;
                              senderPubkeyStr = SENDER_PUBKEY_TO_USE;
                              hasEscrowToClaim = true;
                              
                              console.log('✅✅✅ [SETTLEMENT] Found escrow account from transaction (alternative method)!', {
                                escrowAccountAddress,
                                senderPubkey: SENDER_PUBKEY_TO_USE,
                                threadIdHex,
                                escrowBalance: `${accountInfo.lamports / 1_000_000_000} SOL`,
                                transactionSignature: latestSig.signature,
                                note: 'Will initiate transaction FROM this account TO receiver',
                              });
                              break; // Found it!
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            } catch (txError: any) {
              console.error('[SETTLEMENT] Error parsing latest transaction:', {
                error: txError.message,
                signature: latestSig.signature,
              });
            }
          }
          
          if (!hasEscrowToClaim) {
            console.log('[SETTLEMENT] No pending escrow account found in sender\'s latest transaction.');
          }
        } catch (searchError: any) {
          console.error('[SETTLEMENT] Error fetching transactions:', {
            error: searchError.message,
            stack: searchError.stack,
          });
        }
        
        console.log('[ESCROW LOG] Reply escrow check:', {
          timestamp: new Date().toISOString(),
          mode,
          subject: replyToMessage.subject,
          messageId: replyToMessage.id,
          hasEscrowToClaim,
          threadIdHex: threadIdHex || 'NOT FOUND',
          senderPubkeyStr: senderPubkeyStr || 'NOT FOUND',
          foundEscrow: hasEscrowToClaim,
          searchedMessages: messagesToSearch.length,
          usedFreshData: !!freshEmailData,
          threadIdFromHeaders: threadIdFromHeaders ? 'found' : 'not found',
          senderPubkeyFromHeaders: senderPubkeyFromHeaders ? 'found' : 'not found',
          walletConnected: !!(wallet && publicKey),
          hasWallet: !!wallet,
          hasPublicKey: !!publicKey,
          hasConnection: !!connection,
          hasAdapter: !!wallet?.adapter,
        });

        // CRITICAL: If escrow account found, wallet MUST be connected for settlement
        if (hasEscrowToClaim && (!wallet || !publicKey || !connection || !wallet.adapter)) {
          console.error('[SETTLEMENT] ❌ Wallet not connected but escrow account found - BLOCKING email send:', {
            timestamp: new Date().toISOString(),
            hasWallet: !!wallet,
            hasPublicKey: !!publicKey,
            hasConnection: !!connection,
            hasAdapter: !!wallet?.adapter,
            threadIdHex,
            senderPubkeyStr,
            note: 'Settlement cannot proceed without wallet connection',
          });
          toast.error('⚠️ Escrow account found! Please connect your Solana wallet to complete settlement before sending reply.', { 
            id: 'claim',
            duration: 10000,
          });
          return; // BLOCK email sending until wallet is connected
        }
        
        // Log result of escrow search
        if (!hasEscrowToClaim) {
          console.log('[SETTLEMENT] No escrow account found for this thread - proceeding with email send', {
            timestamp: new Date().toISOString(),
            subject: replyToMessage.subject,
            messageId: replyToMessage.id,
            note: 'This thread may not have an escrow, or the escrow may have already been claimed',
          });
        } else {
          console.log('✅✅✅ [SETTLEMENT] Escrow account found - settlement will be triggered:', {
            threadIdHex,
            senderPubkeyStr,
            replierWallet: publicKey?.toBase58(),
            note: 'Settlement transaction will transfer funds FROM escrow account TO replier wallet',
          });
        }

        // If wallet is connected and there's an escrow, try to claim it
        // CRITICAL: This must complete BEFORE sending the email to ensure settlement happens
        if (hasEscrowToClaim && wallet && publicKey && connection && wallet.adapter) {
          console.log('🚀🚀🚀 [SETTLEMENT] STARTING SETTLEMENT PROCESS:', {
            timestamp: new Date().toISOString(),
            subject: replyToMessage.subject,
            messageId: replyToMessage.id,
            threadIdHex,
            senderPubkeyStr,
            replierWallet: publicKey.toBase58(),
            escrowFound: hasEscrowToClaim,
            connectionEndpoint: connection.rpcEndpoint,
            walletAdapter: wallet.adapter.name,
          });
          
          // Show a clear message that escrow claim is happening
          toast.info('💰 Escrow reward detected! Settlement transaction will transfer funds from escrow to your wallet.', {
            id: 'claim-info',
            duration: 5000,
          });
          
          let claimSuccessful = false;
          
          // CRITICAL: Verify we have all required data
          if (!threadIdHex || !senderPubkeyStr) {
            console.error('❌ [SETTLEMENT] Missing required data:', {
              hasThreadId: !!threadIdHex,
              hasSenderPubkey: !!senderPubkeyStr,
            });
            throw new Error('Missing escrow data: threadId or senderPubkey not found');
          }
          try {
            // We already have threadIdHex and senderPubkeyStr from the check above
            const encoder = new TextEncoder();
            
            if (!threadIdHex) {
              console.warn('⚠️ No thread_id found, cannot claim escrow');
              // Don't block email sending, just skip claim
            } else {
              // Convert hex string back to Uint8Array
              const hashArray = new Uint8Array(32);
              for (let i = 0; i < 32; i++) {
                hashArray[i] = parseInt(threadIdHex.substring(i * 2, i * 2 + 2), 16);
              }
              
              console.log('[ESCROW LOG] Claim attempt:', {
                timestamp: new Date().toISOString(),
                subject: replyToMessage.subject,
                messageId: replyToMessage.id,
                threadIdHex,
                senderPubkeyStr,
                receiverPubkey: publicKey.toBase58(),
              });
              
              if (senderPubkeyStr && escrowAccountAddress) {
                // Use the escrow account address directly from the transaction (no PDA derivation needed)
                const escrowPda = new PublicKey(escrowAccountAddress);
                const senderPubkey = new PublicKey(senderPubkeyStr);

                console.log('[ESCROW LOG] Using escrow account address from transaction:', {
                  timestamp: new Date().toISOString(),
                  escrowAccountAddress,
                  senderPubkey: senderPubkey.toBase58(),
                  threadIdHex,
                  note: 'Using account address directly from transaction, no PDA derivation',
                });

                // Check if escrow account exists and has funds
                const escrowAccount = await connection.getAccountInfo(escrowPda);
                console.log('[ESCROW LOG] Escrow account check:', {
                  timestamp: new Date().toISOString(),
                  escrowPda: escrowPda.toBase58(),
                  exists: !!escrowAccount,
                  owner: escrowAccount?.owner.toBase58(),
                  lamports: escrowAccount?.lamports,
                  balance: escrowAccount ? `${escrowAccount.lamports / 1_000_000_000} SOL` : '0 SOL',
                  expectedOwner: SOLMAIL_ESCROW_PROGRAM_ID.toBase58(),
                  isCorrectOwner: escrowAccount?.owner.equals(SOLMAIL_ESCROW_PROGRAM_ID),
                  willTransferTo: publicKey.toBase58(),
                });
                
                if (escrowAccount && escrowAccount.owner.equals(SOLMAIL_ESCROW_PROGRAM_ID)) {
                  const escrowBalanceBefore = escrowAccount.lamports;
                  const receiverBalanceBefore = await connection.getBalance(publicKey);
                  
                  console.log('[ESCROW LOG] Escrow found, proceeding with claim:', {
                    timestamp: new Date().toISOString(),
                    escrowPda: escrowPda.toBase58(),
                    amount: `${escrowBalanceBefore / 1_000_000_000} SOL`,
                    receiverBalanceBefore: `${receiverBalanceBefore / 1_000_000_000} SOL`,
                  });
                  toast.loading('Claiming escrow reward...', { id: 'claim' });

                  // Build register_and_claim instruction
                  // Data: [8-byte discriminator][32-byte sender_pubkey][32-byte thread_id]
                  const data = new Uint8Array(8 + 32 + 32);
                  data.set(REGISTER_AND_CLAIM_DISCRIMINATOR, 0);
                  data.set(senderPubkey.toBuffer(), 8);
                  data.set(hashArray, 8 + 32);

                  const ix = new TransactionInstruction({
                    programId: SOLMAIL_ESCROW_PROGRAM_ID,
                    keys: [
                      { pubkey: publicKey, isSigner: true, isWritable: true }, // receiver
                      { pubkey: escrowPda, isSigner: false, isWritable: true }, // escrow
                      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system program
                    ],
                    data,
                  });

                  const transaction = new Transaction().add(ix);
                  const { blockhash } = await connection.getLatestBlockhash('confirmed');
                  transaction.recentBlockhash = blockhash;
                  transaction.feePayer = publicKey;
                  
                  // CRITICAL: Verify transaction structure before sending
                  console.log('🔍 [SETTLEMENT] Transaction structure verification:', {
                    instructionCount: transaction.instructions.length,
                    feePayer: transaction.feePayer?.toBase58(),
                    programId: ix.programId.toBase58(),
                    accounts: ix.keys.map(k => ({
                      pubkey: k.pubkey.toBase58(),
                      isSigner: k.isSigner,
                      isWritable: k.isWritable,
                      role: k.pubkey.equals(publicKey) ? 'REPLIER (signer)' : 
                            k.pubkey.equals(escrowPda) ? 'ESCROW_ACCOUNT (writable)' :
                            k.pubkey.equals(SystemProgram.programId) ? 'SYSTEM_PROGRAM' : 'UNKNOWN',
                    })),
                    dataLength: ix.data.length,
                    discriminator: Array.from(ix.data.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(''),
                  });

                  // CRITICAL: Log all transaction details before sending
                  console.log('🚀 [SETTLEMENT] SENDING TRANSACTION - FROM ESCROW TO REPLIER:', {
                    timestamp: new Date().toISOString(),
                    escrowAccountAddress: escrowPda.toBase58(),
                    replierWalletAddress: publicKey.toBase58(),
                    senderPubkey: senderPubkey.toBase58(),
                    amount: `${escrowBalanceBefore / 1_000_000_000} SOL`,
                    threadIdHex,
                    transactionSize: transaction.serialize({ requireAllSignatures: false }).length,
                    instruction: 'register_and_claim',
                    note: 'This transaction will transfer funds FROM the escrow account TO the replier wallet',
                  });
                  
                  console.log('💰 SETTLEMENT TRANSFER DETAILS:', {
                    FROM_ACCOUNT: escrowPda.toBase58(),
                    TO_WALLET: publicKey.toBase58(),
                    AMOUNT: `${escrowBalanceBefore / 1_000_000_000} SOL`,
                    CONDITIONS: 'Reply sent - conditions met',
                    TRANSACTION_TYPE: 'register_and_claim',
                    INITIATED_BY: publicKey.toBase58() + ' (REPLIER)',
                    note: 'Funds will be transferred from the escrow account to your wallet when you sign this transaction',
                  });
                  
                  // Show clear toast with addresses
                  toast.loading(
                    `Settlement: Transferring ${escrowBalanceBefore / 1_000_000_000} SOL from escrow to your wallet. Please sign...`,
                    { id: 'claim' }
                  );
                  
                  let signature: string;
                  try {
                    console.log('[SETTLEMENT] Calling wallet.adapter.sendTransaction...', {
                      replierWallet: publicKey.toBase58(),
                      escrowAccount: escrowPda.toBase58(),
                    });
                    
                    signature = await wallet.adapter.sendTransaction(transaction, connection, {
                      skipPreflight: false,
                      maxRetries: 3,
                    });
                    
                    console.log('✅ [SETTLEMENT] Transaction sent successfully!', {
                      signature,
                      from: escrowPda.toBase58(),
                      to: publicKey.toBase58(),
                    });
                  } catch (sendError: any) {
                    console.error('❌ [SETTLEMENT] Transaction send failed:', {
                      error: sendError,
                      message: sendError.message,
                      stack: sendError.stack,
                      escrowAccount: escrowPda.toBase58(),
                      replierWallet: publicKey.toBase58(),
                    });
                    throw new Error(`Failed to send settlement transaction: ${sendError.message || 'Unknown error'}`);
                  }
                  
                  console.log('✅ [SETTLEMENT] Transaction sent - waiting for confirmation:', {
                    timestamp: new Date().toISOString(),
                    signature,
                    escrowAccount: escrowPda.toBase58(),
                    replierWallet: publicKey.toBase58(),
                    amount: `${escrowBalanceBefore / 1_000_000_000} SOL`,
                  });

                  // Detect network from connection endpoint
                  const isDevnet = connection.rpcEndpoint.includes('devnet') || connection.rpcEndpoint.includes('localhost');
                  const cluster = isDevnet ? 'devnet' : 'mainnet-beta';
                  
                  // Log transaction details for block explorer
                  const explorerUrl = `https://solscan.io/tx/${signature}${isDevnet ? '?cluster=devnet' : ''}`;
                  const solanaExplorerUrl = `https://explorer.solana.com/tx/${signature}?cluster=${cluster}`;
                  const escrowAccountUrl = `https://solscan.io/account/${escrowPda.toBase58()}${isDevnet ? '?cluster=devnet' : ''}`;
                  
                  console.log('💰 [SETTLEMENT] TRANSACTION DETAILS:', {
                    signature,
                    FROM_ESCROW_ACCOUNT: escrowPda.toBase58(),
                    TO_REPLIER_WALLET: publicKey.toBase58(),
                    AMOUNT: `${escrowBalanceBefore / 1_000_000_000} SOL`,
                    INITIATED_BY: publicKey.toBase58() + ' (REPLIER)',
                    explorer: explorerUrl,
                    solanaExplorer: solanaExplorerUrl,
                    escrowAccountExplorer: escrowAccountUrl,
                  });
                  
                  console.log(`🔗 [SETTLEMENT] View transaction on Solscan: ${explorerUrl}`);
                  console.log(`🔗 [SETTLEMENT] View escrow account: ${escrowAccountUrl}`);
                  console.log(`🔗 [SETTLEMENT] View on Solana Explorer: ${solanaExplorerUrl}`);
                  
                  // Show toast with explorer link
                  toast.info(
                    `Settlement transaction sent! View: ${explorerUrl.slice(0, 50)}...`,
                    { id: 'settlement-tx', duration: 10000 }
                  );

                  // Wait for confirmation - CRITICAL: Don't proceed until confirmed
                  // Use multiple confirmation methods for reliability
                  let confirmed = false;
                  let attempts = 0;
                  const maxAttempts = 90; // Increased timeout for mainnet (90 seconds)
                  
                  console.log('[ESCROW LOG] Waiting for transaction confirmation...', {
                    signature,
                    maxAttempts,
                    escrowPda: escrowPda.toBase58(),
                  });
                  
                  while (!confirmed && attempts < maxAttempts) {
                    try {
                      // Method 1: Check signature status
                      const status = await connection.getSignatureStatus(signature, {
                        searchTransactionHistory: true,
                      });
                      
                      if (status?.value?.confirmationStatus === 'confirmed' || status?.value?.confirmationStatus === 'finalized') {
                        confirmed = true;
                        console.log('[ESCROW LOG] Transaction confirmed via signature status:', {
                          confirmationStatus: status.value.confirmationStatus,
                          attempts,
                        });
                        break;
                      }
                      
                      if (status?.value?.err) {
                        console.error('[ESCROW LOG] Transaction failed:', status.value.err);
                        throw new Error(`Transaction failed: ${JSON.stringify(status.value.err)}`);
                      }
                      
                      // Method 2: Check if escrow account was closed (alternative confirmation)
                      if (attempts > 5) { // Start checking after a few seconds
                        try {
                          const escrowCheck = await connection.getAccountInfo(escrowPda);
                          if (!escrowCheck || escrowCheck.owner.equals(SystemProgram.programId)) {
                            // Escrow account closed = transaction succeeded
                            confirmed = true;
                            console.log('[ESCROW LOG] Transaction confirmed via escrow account closure:', {
                              attempts,
                              escrowClosed: true,
                            });
                            break;
                          }
                        } catch (checkError) {
                          // Ignore check errors, continue polling
                        }
                      }
                      
                      await new Promise((resolve) => setTimeout(resolve, 1000));
                      attempts++;
                      
                      // Log progress every 10 attempts
                      if (attempts % 10 === 0) {
                        console.log('[ESCROW LOG] Still waiting for confirmation...', {
                          attempts,
                          maxAttempts,
                          signature,
                        });
                      }
                    } catch (error) {
                      console.error('[ESCROW LOG] Error checking claim transaction status:', error);
                      attempts++;
                      await new Promise((resolve) => setTimeout(resolve, 1000));
                    }
                  }

                  if (confirmed) {
                    // Verify the transaction actually executed by checking transaction details
                    let transactionDetails;
                    try {
                      transactionDetails = await connection.getTransaction(signature, {
                        commitment: 'confirmed',
                        maxSupportedTransactionVersion: 0,
                      });
                      console.log('[ESCROW LOG] Transaction details retrieved:', {
                        meta: transactionDetails?.meta,
                        err: transactionDetails?.meta?.err,
                        logMessages: transactionDetails?.meta?.logMessages,
                      });
                    } catch (txError) {
                      console.warn('[ESCROW LOG] Could not fetch transaction details:', txError);
                    }
                    
                    // Verify the escrow account was closed and funds transferred
                    // Wait a moment for state to update
                    await new Promise((resolve) => setTimeout(resolve, 3000));
                    
                    // Check that escrow account is closed (funds transferred)
                    const escrowAccountAfter = await connection.getAccountInfo(escrowPda);
                    const receiverBalanceAfter = await connection.getBalance(publicKey);
                    const balanceIncrease = receiverBalanceAfter - receiverBalanceBefore;
                    
                    // Calculate expected transfer amount (escrow balance minus rent)
                    const rentExemptMinimum = await connection.getMinimumBalanceForRentExemption(8 + 130); // 8 (discriminator) + Escrow::LEN
                    const expectedTransfer = escrowBalanceBefore - rentExemptMinimum;
                    
                    console.log('[ESCROW LOG] Escrow claim successful - verifying transfer:', {
                      timestamp: new Date().toISOString(),
                      signature,
                      escrowPda: escrowPda.toBase58(),
                      receiver: publicKey.toBase58(),
                      escrowAccountClosed: !escrowAccountAfter || escrowAccountAfter.owner.equals(SystemProgram.programId),
                      receiverBalanceBefore: `${receiverBalanceBefore / 1_000_000_000} SOL`,
                      receiverBalanceAfter: `${receiverBalanceAfter / 1_000_000_000} SOL`,
                      balanceIncrease: `${balanceIncrease / 1_000_000_000} SOL`,
                      originalEscrowAmount: `${escrowBalanceBefore / 1_000_000_000} SOL`,
                      expectedTransfer: `${expectedTransfer / 1_000_000_000} SOL`,
                      transactionError: transactionDetails?.meta?.err,
                    });
                    
                    if (!escrowAccountAfter || escrowAccountAfter.owner.equals(SystemProgram.programId)) {
                      // Escrow account is closed, funds have been transferred to receiver
                      const transferAmount = escrowBalanceBefore;
                      claimSuccessful = true;
                      toast.success(
                        `✅ Settlement complete! ${transferAmount / 1_000_000_000} SOL transferred FROM escrow ${escrowPda.toBase58().slice(0, 8)}... TO your wallet ${publicKey.toBase58().slice(0, 8)}...`,
                        { id: 'claim', duration: 10000 }
                      );
                      console.log('✅✅✅ [SETTLEMENT COMPLETE] Funds successfully transferred:', {
                        FROM_ESCROW_ACCOUNT: escrowPda.toBase58(),
                        TO_REPLIER_WALLET: publicKey.toBase58(),
                        AMOUNT: `${transferAmount / 1_000_000_000} SOL`,
                        SIGNATURE: signature,
                        TRANSACTION_URL: explorerUrl,
                        ESCROW_ACCOUNT_URL: escrowAccountUrl,
                        CONDITIONS: 'Reply sent - conditions met',
                        STATUS: 'Escrow account closed, funds transferred',
                      });
                    } else if (balanceIncrease > 0) {
                      // Balance increased but escrow account still exists (might be closing)
                      claimSuccessful = true;
                      toast.success(
                        `✅ Settlement complete! ${balanceIncrease / 1_000_000_000} SOL received FROM escrow ${escrowPda.toBase58().slice(0, 8)}... TO your wallet.`,
                        { id: 'claim', duration: 10000 }
                      );
                      console.log('✅✅✅ [SETTLEMENT COMPLETE] Balance increased:', {
                        FROM_ESCROW_ACCOUNT: escrowPda.toBase58(),
                        TO_REPLIER_WALLET: publicKey.toBase58(),
                        AMOUNT: `${balanceIncrease / 1_000_000_000} SOL`,
                        SIGNATURE: signature,
                        CONDITIONS: 'Reply sent - conditions met',
                        STATUS: 'Funds transferred, escrow closing',
                      });
                    } else {
                      // Check if transaction had an error
                      if (transactionDetails?.meta?.err) {
                        console.error('[ESCROW LOG] ❌ Transaction had an error:', transactionDetails.meta.err);
                        throw new Error(`Transaction failed: ${JSON.stringify(transactionDetails.meta.err)}`);
                      }
                      console.warn('[ESCROW LOG] ⚠️ Escrow account still exists and balance unchanged - may need more time to process');
                      toast.warning('Transaction confirmed but settlement pending. Please check transaction explorer.', { id: 'claim' });
                    }
                  } else {
                    // Transaction didn't confirm in time - but check if it actually succeeded
                    console.warn('[ESCROW LOG] Transaction confirmation timeout, checking if it actually succeeded...', {
                      signature,
                      attempts,
                      maxAttempts,
                    });
                    
                    // Final check: see if escrow account was closed
                    try {
                      const finalEscrowCheck = await connection.getAccountInfo(escrowPda);
                      const finalReceiverBalance = await connection.getBalance(publicKey);
                      const finalBalanceIncrease = finalReceiverBalance - receiverBalanceBefore;
                      
                      if (!finalEscrowCheck || finalEscrowCheck.owner.equals(SystemProgram.programId)) {
                        // Escrow closed = transaction succeeded despite timeout
                        claimSuccessful = true;
                        console.log('[ESCROW LOG] ✅ Transaction succeeded (escrow closed) despite timeout:', {
                          escrowPda: escrowPda.toBase58(),
                          balanceIncrease: `${finalBalanceIncrease / 1_000_000_000} SOL`,
                        });
                        toast.success(`✅ Settlement complete! ${finalBalanceIncrease / 1_000_000_000} SOL transferred.`, { id: 'claim' });
                      } else if (finalBalanceIncrease > 0) {
                        // Balance increased = transaction succeeded
                        claimSuccessful = true;
                        console.log('[ESCROW LOG] ✅ Transaction succeeded (balance increased) despite timeout:', {
                          escrowPda: escrowPda.toBase58(),
                          balanceIncrease: `${finalBalanceIncrease / 1_000_000_000} SOL`,
                        });
                        toast.success(`✅ Settlement complete! ${finalBalanceIncrease / 1_000_000_000} SOL received.`, { id: 'claim' });
                      } else {
                        // Transaction likely failed or still pending
                        console.error('[ESCROW LOG] ❌ Transaction confirmation timeout and no evidence of success:', {
                          signature,
                          escrowPda: escrowPda.toBase58(),
                          escrowStillExists: !!finalEscrowCheck,
                          balanceIncrease: finalBalanceIncrease,
                        });
                        throw new Error(`Transaction confirmation timeout after ${maxAttempts} seconds. Please check transaction: ${explorerUrl}`);
                      }
                    } catch (finalCheckError) {
                      console.error('[ESCROW LOG] Error in final check:', finalCheckError);
                      throw new Error(`Transaction confirmation timeout. Please check transaction: ${explorerUrl}`);
                    }
                  }
                } else {
                  console.warn('[ESCROW LOG] Escrow account not found or already claimed:', {
                    timestamp: new Date().toISOString(),
                    escrowPda: escrowPda.toBase58(),
                    exists: !!escrowAccount,
                    owner: escrowAccount?.owner.toBase58(),
                    expectedOwner: SOLMAIL_ESCROW_PROGRAM_ID.toBase58(),
                  });
                  toast.warning('Escrow account not found or already claimed', { id: 'claim' });
                }
              } else {
                console.warn('[ESCROW LOG] No sender pubkey found:', {
                  timestamp: new Date().toISOString(),
                  subject: replyToMessage.subject,
                  messageId: replyToMessage.id,
                });
                toast.info('Escrow claim skipped: sender pubkey not found', { id: 'claim' });
              }
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
            toast.error(`❌ Settlement failed: ${errorMessage}`, { 
              id: 'claim',
              duration: 10000,
            });
            
            // CRITICAL: If escrow exists, settlement MUST succeed before email is sent
            // This ensures funds are transferred from escrow account to replier
            if (hasEscrowToClaim) {
              console.error('[ESCROW LOG] ❌ SETTLEMENT FAILED - Blocking email send until settlement succeeds', {
                error: errorMessage,
                threadIdHex,
                senderPubkeyStr,
                escrowPda: threadIdHex && senderPubkeyStr ? 'Will be derived on retry' : 'Cannot derive',
              });
              
              // Show detailed error with retry option
              toast.error(
                `Settlement failed. Please retry. Error: ${errorMessage}`,
                { 
                  id: 'settlement-failed',
                  duration: 15000,
                  action: {
                    label: 'Retry',
                    onClick: () => {
                      // User can retry by clicking send again
                      console.log('[ESCROW LOG] User requested retry');
                    },
                  },
                }
              );
              
              // Block email sending - settlement must succeed first
              throw new Error(`Settlement failed: ${errorMessage}. Please ensure your wallet is connected and has sufficient balance for transaction fees.`);
            } else {
              // No escrow to claim, so proceed normally
              console.warn('[ESCROW LOG] No escrow to claim, proceeding with email send');
            }
          }
          
          // Final check: if escrow exists, settlement MUST have succeeded
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
          
          if (claimSuccessful) {
            console.log('[ESCROW LOG] ✅ Settlement successful - proceeding with email send', {
              threadIdHex,
              senderPubkeyStr,
            });
          }
        } else if (hasEscrowToClaim) {
          // Escrow found but wallet not connected - already blocked above, but log it
          console.warn('[SETTLEMENT] Escrow found but wallet not connected - email send blocked');
        } else {
          // No escrow found - proceed with email send normally
          console.log('[SETTLEMENT] No escrow to claim - proceeding with email send');
        }
      }

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

      // After email is sent, if escrow headers were found but claim wasn't successful, try auto-claim
      if (isReplyMode && hasEscrowToClaim && threadIdHex && senderPubkeyStr && wallet && publicKey) {
        // Give it a moment for the email to be sent, then try automatic claim
        setTimeout(async () => {
          console.log('[ESCROW LOG] Attempting automatic escrow claim after email send');
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
