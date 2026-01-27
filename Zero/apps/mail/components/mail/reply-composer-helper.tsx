/**
 * REPLY ESCROW LOGIC helpers
 * Steps 1–5 with sub-points (a–f or a–g). Extracted from reply-composer.tsx.
 */

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
} from '@solana/web3.js';
import { toast } from 'sonner';

// SolMail Escrow program configuration
export const SOLMAIL_ESCROW_PROGRAM_ID = new PublicKey(
  'DQgzwnMGkmgB5kC92ES28Kgw9gqfcpSnXgy8ogjjLuvd'
);
export const REGISTER_AND_CLAIM_DISCRIMINATOR = Uint8Array.from([
  127, 144, 210, 98, 66, 165, 255, 139,
]);

export type ScoringProgressStep =
  | 'reading_input'
  | 'calculating_score'
  | 'creating_recommendations'
  | 'completed';

export interface EscrowDiscoveryResult {
  hasEscrowToClaim: boolean;
  threadIdHex?: string;
  senderPubkeyStr?: string;
  escrowAccountAddress?: string;
}

export interface EscrowHeadersResult {
  threadIdFromHeaders?: string;
  senderPubkeyFromHeaders?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type QueryClient = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Trpc = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ScoreEmailFn = (opts: any) => Promise<any>;

/** Minimal wallet adapter shape used by escrow helpers */
/** Minimal wallet adapter shape used by escrow helpers. Real adapters may have broader types. */
export interface WalletAdapterLike {
  signTransaction(tx: Transaction): Promise<Transaction>;
  connected: boolean;
  name?: string;
}

export interface WalletLike {
  adapter?: WalletAdapterLike;
}

// -----------------------------------------------------------------------------
// REPLY ESCROW LOGIC 1: Fetch Fresh Thread Data
// Purpose: Get escrow headers (X-Solmail-Thread-Id, X-Solmail-Sender-Pubkey)
// -----------------------------------------------------------------------------

export async function fetchFreshThreadData(opts: {
  threadId: string | null;
  queryClient: QueryClient;
  trpc: Trpc;
  fallbackEmailData: unknown;
}): Promise<unknown> {
  const { threadId, queryClient, trpc, fallbackEmailData } = opts;
  if (!threadId) return fallbackEmailData;

  try {
    const freshData = await queryClient
      .fetchQuery(trpc.mail.get.queryOptions({ id: threadId, forceFresh: true }))
      .catch((err: unknown) => {
        console.warn('[ESCROW LOG] TRPC query failed, will use cached data:', err);
        return null;
      });
    if (freshData) {
      console.log('[ESCROW LOG] Fresh thread data fetched:');
      return freshData;
    }
    console.log('[ESCROW LOG] Using cached email data for escrow header search');
    return fallbackEmailData;
  } catch (error) {
    console.error('[ESCROW LOG] Failed to fetch fresh thread data, using cached:', error);
    return fallbackEmailData;
  }
}

// -----------------------------------------------------------------------------
// REPLY ESCROW LOGIC 2: Score the email reply
// Purpose: Runs SendAI agent in the backend, with progress polling in the frontend.
// -----------------------------------------------------------------------------

export async function scoreEmailReply(opts: {
  queryClient: QueryClient;
  trpc: Trpc;
  scoreEmail: ScoreEmailFn;
  replyContent: string;
  threadEmails: { decodedBody: string; subject: string }[];
  progressPollIntervalRef: { current: NodeJS.Timeout | null };
  setScoringRequestId: (id: string | null) => void;
  setScoringProgress: (step: ScoringProgressStep) => void;
  setScoringResult: (r: { score: number; recommendations: string[] } | null) => void;
  setScoringModalOpen: (open: boolean) => void;
}): Promise<
  | { emailScore: number; escrowDecision: 'RELEASE' }
  | { emailScore: number; escrowDecision: 'WITHHOLD'; withhold: true }
> {
  const {
    queryClient,
    trpc,
    scoreEmail: scoreEmailMutate,
    replyContent,
    threadEmails,
    progressPollIntervalRef,
    setScoringRequestId,
    setScoringProgress,
    setScoringResult,
    setScoringModalOpen,
  } = opts;

  console.log('[EMAIL SCORING] Starting email scoring before escrow release:');

  const requestId = `score-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  setScoringRequestId(requestId);
  setScoringProgress('reading_input');
  setScoringResult(null);
  setScoringModalOpen(true);

  const pollProgress = async () => {
    if (!requestId) return;
    try {
      const progress = await queryClient.fetchQuery(
        trpc.mail.scoreEmailProgress.queryOptions({ requestId })
      );
      if (progress.step && progress.step !== 'completed') {
        setScoringProgress(progress.step as ScoringProgressStep);
      }
      if (progress.completed && progress.result) {
        setScoringProgress('completed');
        setScoringResult({
          score: progress.result.score,
          recommendations: progress.result.recommendations || [],
        });
        if (progressPollIntervalRef.current) {
          clearInterval(progressPollIntervalRef.current);
          progressPollIntervalRef.current = null;
        }
      } else if (progress.completed && progress.error) {
        setScoringModalOpen(false);
        toast.error(`Failed to score email: ${progress.error}`, {
          id: 'email-scoring-error',
          duration: 10000,
        });
        throw new Error(`Email scoring failed: ${progress.error}`);
      }
    } catch (error) {
      console.error('[EMAIL SCORING] Error polling progress:', error);
    }
  };

  progressPollIntervalRef.current = setInterval(pollProgress, 300);
  pollProgress();

  const scoringResult = await scoreEmailMutate({
    replyContent,
    threadEmails: threadEmails.length > 0 ? threadEmails : undefined,
    requestId,
  });

  if (progressPollIntervalRef.current) {
    clearInterval(progressPollIntervalRef.current);
    progressPollIntervalRef.current = null;
  }

  const emailScore = scoringResult.score;
  const escrowDecision = scoringResult.decision as 'RELEASE' | 'WITHHOLD';

  setScoringProgress('completed');
  setScoringResult({
    score: scoringResult.score,
    recommendations: scoringResult.recommendations || [],
  });

  if (escrowDecision === 'WITHHOLD') {
    console.log('[EMAIL SCORING] ❌ Email score too low - blocking escrow release:', {
      score: emailScore,
      threshold: 70,
      decision: escrowDecision,
    });
    return { emailScore, escrowDecision, withhold: true };
  }

  console.log('[EMAIL SCORING] ✅ Email score meets threshold - proceeding with escrow release:', {
    score: emailScore,
    decision: escrowDecision,
  });
  return { emailScore, escrowDecision };
}

// -----------------------------------------------------------------------------
// REPLY ESCROW LOGIC 3: Escrow account discovery
// a) Escrow header extraction (search all msgs for headers)
// b) Transaction discovery (search sender's latest transactions)
// c) Account key extraction
// d) Escrow account discovery (from account key)
// e) Wallet connection check
// (f) Send email → Step 5
// -----------------------------------------------------------------------------

/** 3a) Escrow header extraction – search all messages for X-Solmail-* headers */
export function extractEscrowHeadersFromMessages(
  messages: { headers?: Record<string, string> }[]
): EscrowHeadersResult {
  let threadIdFromHeaders: string | undefined;
  let senderPubkeyFromHeaders: string | undefined;

  for (const msg of messages) {
    const msgHeaders = msg?.headers || {};
    const foundThreadId =
      msgHeaders['X-Solmail-Thread-Id'] ||
      msgHeaders['x-solmail-thread-id'] ||
      msgHeaders['X-SOLMAIL-THREAD-ID'] ||
      msgHeaders['X-Solmail-Thread-ID'];
    const foundSenderPubkey =
      msgHeaders['X-Solmail-Sender-Pubkey'] ||
      msgHeaders['x-solmail-sender-pubkey'] ||
      msgHeaders['X-SOLMAIL-SENDER-PUBKEY'] ||
      msgHeaders['X-Solmail-Sender-PUBKEY'];

    if (foundThreadId && foundSenderPubkey) {
      threadIdFromHeaders = foundThreadId;
      senderPubkeyFromHeaders = foundSenderPubkey;
      console.log('✅ [SETTLEMENT] Found escrow headers in message:');
      break;
    }
  }
  return { threadIdFromHeaders, senderPubkeyFromHeaders };
}

/** 3b) Transaction discovery – fetch latest signature for sender */
export async function fetchLatestSenderSignature(
  connection: Connection,
  senderPubkey: PublicKey
): Promise<{ signature: string } | null> {
  const signatures = await connection.getSignaturesForAddress(senderPubkey, {
    limit: 1,
  });
  if (signatures.length === 0) {
    console.log('[SETTLEMENT] No transactions found from sender');
    return null;
  }
  return { signature: signatures[0].signature };
}

/** 3c) Account key extraction from transaction */
export function extractAccountKeysFromTransaction(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: { transaction: { message: any }; meta?: unknown }
): unknown[] {
  const msg = tx.transaction.message;
  if ('accountKeys' in msg && msg.accountKeys) {
    return msg.accountKeys as unknown[];
  }
  if ('getAccountKeys' in msg && typeof msg.getAccountKeys === 'function') {
    return msg.getAccountKeys().keySegments().flat();
  }
  console.log('[SETTLEMENT] Could not extract account keys from transaction');
  return [];
}

/** 3b–3d) Transaction discovery → account key extraction → escrow discovery */
export async function discoverEscrowAccount(opts: {
  connection: Connection;
  senderPubkey: PublicKey;
  threadIdFromHeaders: string;
  programId: PublicKey;
}): Promise<EscrowDiscoveryResult> {
  const { connection, senderPubkey, threadIdFromHeaders, programId } = opts;

  try {
    const sigResult = await fetchLatestSenderSignature(connection, senderPubkey);
    if (!sigResult) return { hasEscrowToClaim: false };

    try {
      const tx = await connection.getTransaction(sigResult.signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });
      if (!tx?.meta) {
        console.log('[SETTLEMENT] Could not parse latest transaction');
        return { hasEscrowToClaim: false };
      }

      const accountKeys = extractAccountKeysFromTransaction(tx);
      const result = await discoverEscrowAccountFromTx({
        connection,
        tx: tx as { transaction: { message: unknown }; meta: { preBalances?: number[]; postBalances?: number[] } },
        accountKeys,
        senderPubkey,
        threadIdFromHeaders,
        programId,
      });

      if (!result.hasEscrowToClaim) {
        console.log("[SETTLEMENT] No pending escrow account found in sender's latest transaction.");
      }
      return result;
    } catch (txError: unknown) {
      const err = txError as Error;
      console.error('[SETTLEMENT] Error parsing latest transaction:', {
        error: err.message,
        signature: sigResult.signature,
      });
      return { hasEscrowToClaim: false };
    }
  } catch (searchError: unknown) {
    const err = searchError as Error;
    console.error('[SETTLEMENT] Error fetching transactions:', {
      error: err.message,
      stack: err.stack,
    });
    return { hasEscrowToClaim: false };
  }
}

/** 3d) Escrow account discovery from account keys + balances */
export async function discoverEscrowAccountFromTx(opts: {
  connection: Connection;
  tx: {
    transaction: { message: unknown };
    meta?: { preBalances?: number[]; postBalances?: number[] };
  };
  accountKeys: unknown[];
  senderPubkey: PublicKey;
  threadIdFromHeaders: string;
  programId: PublicKey;
}): Promise<EscrowDiscoveryResult> {
  const {
    connection,
    tx,
    accountKeys,
    senderPubkey,
    threadIdFromHeaders,
    programId,
  } = opts;

  const result: EscrowDiscoveryResult = { hasEscrowToClaim: false };

  if (!accountKeys?.length) {
    console.log('[SETTLEMENT] No account keys extracted from transaction');
    return result;
  }

  const hasEscrowProgram = accountKeys.some((key: unknown) => {
    if (!key) return false;
    const pubkey =
      typeof key === 'string' ? new PublicKey(key) : (key as { pubkey?: PublicKey }).pubkey ?? key;
    const p = pubkey instanceof PublicKey ? pubkey : new PublicKey(pubkey as string);
    return p.equals(programId);
  });

  if (!hasEscrowProgram) {
    console.log("[SETTLEMENT] Latest transaction does not involve SolMail's escrow program");
    return result;
  }

  const meta = tx.meta;
  if (
    !meta?.preBalances ||
    !meta?.postBalances ||
    accountKeys.length !== meta.preBalances.length
  ) {
    return result;
  }

  for (let i = 0; i < accountKeys.length; i++) {
    const accountKey = accountKeys[i];
    if (!accountKey) continue;

    const accountPubkey =
      typeof accountKey === 'string'
        ? new PublicKey(accountKey)
        : new PublicKey((accountKey as { pubkey?: PublicKey }).pubkey ?? (accountKey as string));

    if (accountPubkey.equals(senderPubkey) || accountPubkey.equals(programId)) continue;

    const preBalance = meta.preBalances[i];
    const postBalance = meta.postBalances[i];
    const balanceChange = postBalance - preBalance;

    if (balanceChange <= 0) continue;

    const accountInfo = await connection.getAccountInfo(accountPubkey);
    if (!accountInfo || !accountInfo.owner.equals(programId)) continue;

    const data = accountInfo.data;
    if (data.length <= 128) continue;

    const statusByte = data[128];
    if (statusByte !== 0) continue;

    const senderPubkeyBytes = data.slice(8, 40);
    const threadIdBytes = data.slice(72, 104);
    const escrowSenderPubkey = new PublicKey(senderPubkeyBytes);
    const threadIdHexFromEscrow = Array.from(threadIdBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    if (
      escrowSenderPubkey.equals(senderPubkey) &&
      threadIdHexFromEscrow === threadIdFromHeaders
    ) {
      result.escrowAccountAddress = accountPubkey.toBase58();
      result.threadIdHex = threadIdHexFromEscrow;
      result.senderPubkeyStr = senderPubkey.toBase58();
      result.hasEscrowToClaim = true;
      console.log('✅✅✅ [SETTLEMENT] Found escrow account from LATEST transaction!');
      break;
    }
  }

  return result;
}

/** 3e) Wallet connection check – block send if escrow found but wallet disconnected */
export function ensureWalletConnectedForEscrow(opts: {
  hasEscrowToClaim: boolean;
  wallet: WalletLike | null;
  publicKey: PublicKey | null;
  connection: Connection | null;
}): boolean {
  const { hasEscrowToClaim, wallet, publicKey, connection } = opts;
  if (!hasEscrowToClaim) return true;

  if (!wallet || !publicKey || !connection || !wallet.adapter) {
    console.error(
      '[SETTLEMENT] ❌ Wallet not connected but escrow account found - BLOCKING email send:'
    );
    toast.error('Escrow account found! Please connect your Solana wallet before sending reply.', {
      id: 'claim',
      duration: 10000,
    });
    return false;
  }
  return true;
}

// -----------------------------------------------------------------------------
// REPLY ESCROW LOGIC 4: Escrow settlement/claiming
// a) Scoring check (decision is RELEASE)
// b) Verify we have all required data (threadIdHex, senderPubkeyStr)
// c) Claim escrow account
// d) Send transaction
// e) Wait for confirmation
// f) Verify transaction executed
// g) Verify escrow account closed and funds transferred
// -----------------------------------------------------------------------------

/** 4a) Scoring check – ensure decision is RELEASE before claiming */
export function checkScoringRelease(opts: {
  escrowDecision: 'RELEASE' | 'WITHHOLD' | undefined;
  emailScore: number | undefined;
}): boolean {
  const { escrowDecision, emailScore } = opts;
  if (escrowDecision === 'RELEASE') return true;
  console.log('[ESCROW LOG] ❌ Escrow release blocked - email scoring decision is not RELEASE:', {
    decision: escrowDecision,
    score: emailScore,
  });
  toast.error(`Email quality score (${emailScore ?? 'N/A'}/100) does not meet threshold.`, {
    duration: 10000,
  });
  return false;
}

/** 4b) Verify we have threadIdHex and senderPubkeyStr */
export function verifyEscrowData(
  threadIdHex: string | undefined,
  senderPubkeyStr: string | undefined
): void {
  if (threadIdHex && senderPubkeyStr) return;
  console.error('❌ [SETTLEMENT] Missing required data:', {
    hasThreadId: !!threadIdHex,
    hasSenderPubkey: !!senderPubkeyStr,
  });
  throw new Error('Missing escrow data: threadId or senderPubkey not found');
}

/** 4c–4g) Claim escrow, send tx, wait for confirmation, verify */
export async function executeEscrowSettlement(opts: {
  connection: Connection;
  wallet: WalletLike;
  publicKey: PublicKey;
  threadIdHex: string;
  senderPubkeyStr: string;
  escrowAccountAddress: string;
  programId: PublicKey;
  discriminator: Uint8Array;
}): Promise<boolean> {
  const {
    connection,
    wallet,
    publicKey,
    threadIdHex,
    senderPubkeyStr,
    escrowAccountAddress,
    programId,
    discriminator,
  } = opts;

  const escrowPda = new PublicKey(escrowAccountAddress);
  const senderPubkey = new PublicKey(senderPubkeyStr);

  const escrowAccount = await connection.getAccountInfo(escrowPda);
  if (!escrowAccount || !escrowAccount.owner.equals(programId)) {
    console.warn('[ESCROW LOG] Escrow account not found or already claimed:', {
      timestamp: new Date().toISOString(),
      escrowPda: escrowPda.toBase58(),
      exists: !!escrowAccount,
      owner: escrowAccount?.owner.toBase58(),
      expectedOwner: programId.toBase58(),
    });
    toast.warning('Escrow account not found or already claimed', { id: 'claim' });
    return false;
  }

  const escrowBalanceBefore = escrowAccount.lamports;
  const receiverBalanceBefore = await connection.getBalance(publicKey);

  const hashArray = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    hashArray[i] = parseInt(threadIdHex.substring(i * 2, i * 2 + 2), 16);
  }

  const data = new Uint8Array(8 + 32 + 32);
  data.set(discriminator, 0);
  data.set(senderPubkey.toBuffer(), 8);
  data.set(hashArray, 8 + 32);

  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: publicKey, isSigner: true, isWritable: true },
      { pubkey: escrowPda, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: data as unknown as Buffer,
  });

  const transaction = new Transaction().add(ix);
  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = publicKey;

  toast.loading(`Settlement: Transferring funds to your wallet. Please sign...`, { id: 'claim' });

  if (!wallet?.adapter?.connected) {
    throw new Error('Wallet is not connected');
  }

  const balance = await connection.getBalance(publicKey);
  const minBalanceForFees = 5000;
  if (balance < minBalanceForFees) {
    throw new Error(
      `Insufficient balance for transaction fees. Need at least ${minBalanceForFees / 1_000_000_000} SOL`
    );
  }

  try {
    const serialized = transaction.serialize({ requireAllSignatures: false });
    if (serialized.length > 1232) {
      throw new Error(`Transaction too large: ${serialized.length} bytes (max 1232)`);
    }
  } catch (validationError: unknown) {
    const err = validationError as Error;
    console.error('❌ [SETTLEMENT] Transaction validation failed:', validationError);
    throw new Error(`Transaction validation failed: ${err.message}`);
  }

  console.log('🔍 [SETTLEMENT] Simulating transaction...');
  const sim = await connection.simulateTransaction(transaction);
  if (sim.value.err) {
    const errorMessage =
      typeof sim.value.err === 'object'
        ? JSON.stringify(sim.value.err, null, 2)
        : String(sim.value.err);
    throw new Error(
      `Transaction simulation failed: ${errorMessage}. ` +
        `Check logs: ${(sim.value.logs as string[])?.join('\n') || 'No logs'}`
    );
  }
  console.log('✅ [SETTLEMENT] Simulation passed - safe to send');

  let signature: string;
  try {
    const signed = await wallet.adapter!.signTransaction(transaction);
    signature = await connection.sendRawTransaction(signed.serialize(), {
      skipPreflight: false,
      maxRetries: 3,
    });
  } catch (sendError: unknown) {
    const err = sendError as Error;
    console.error('❌ [SETTLEMENT] Transaction send failed:', {
      error: sendError,
      message: err?.message,
      walletConnected: wallet?.adapter?.connected,
      publicKey: publicKey?.toBase58(),
    });
    throw new Error(`Failed to send settlement transaction: ${err.message || 'Unknown error'}`);
  }

  console.log('✅ [SETTLEMENT] Transaction sent - waiting for confirmation:');

  const isDevnet =
    connection.rpcEndpoint.includes('devnet') ||
    connection.rpcEndpoint.includes('localhost');
  const explorerUrl = `https://solscan.io/tx/${signature}${isDevnet ? '?cluster=devnet' : ''}`;
  const escrowAccountUrl = `https://solscan.io/account/${escrowPda.toBase58()}${isDevnet ? '?cluster=devnet' : ''}`;

  const maxAttempts = 90;
  let confirmed = false;
  let attempts = 0;

  while (!confirmed && attempts < maxAttempts) {
    try {
      const status = await connection.getSignatureStatus(signature, {
        searchTransactionHistory: true,
      });

      if (
        status?.value?.confirmationStatus === 'confirmed' ||
        status?.value?.confirmationStatus === 'finalized'
      ) {
        confirmed = true;
        break;
      }
      if (status?.value?.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(status.value.err)}`);
      }

      if (attempts > 5) {
        try {
          const escrowCheck = await connection.getAccountInfo(escrowPda);
          if (!escrowCheck || escrowCheck.owner.equals(SystemProgram.programId)) {
            confirmed = true;
            break;
          }
        } catch {
          /* ignore */
        }
      }

      await new Promise((r) => setTimeout(r, 1000));
      attempts++;
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
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  let transactionDetails: { meta?: { err?: unknown } } | null | undefined;
  if (confirmed) {
    try {
      const tx = await connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });
      transactionDetails = tx as { meta?: { err?: unknown } } | null;
    } catch {
      /* ignore */
    }
  }

  await new Promise((r) => setTimeout(r, 3000));

  const escrowAccountAfter = await connection.getAccountInfo(escrowPda);
  const receiverBalanceAfter = await connection.getBalance(publicKey);
  const balanceIncrease = receiverBalanceAfter - receiverBalanceBefore;

  if (confirmed) {
    if (!escrowAccountAfter || escrowAccountAfter.owner.equals(SystemProgram.programId)) {
      const transferAmount = escrowBalanceBefore;
      toast.success(
        `Settlement complete! ${transferAmount / 1_000_000_000} SOL transferred to your wallet.`,
        { id: 'claim', duration: 5000 }
      );
      console.log('✅✅✅ [SETTLEMENT COMPLETE] Funds successfully transferred:', {
        FROM_ESCROW_ACCOUNT: escrowPda.toBase58(),
        TO_REPLIER_WALLET: publicKey.toBase58(),
        AMOUNT: `${transferAmount / 1_000_000_000} SOL`,
        SIGNATURE: signature,
        TRANSACTION_URL: explorerUrl,
        ESCROW_ACCOUNT_URL: escrowAccountUrl,
      });
      return true;
    }
    if (balanceIncrease > 0) {
      toast.success(
        `✅ Settlement complete! ${balanceIncrease / 1_000_000_000} SOL received FROM escrow ${escrowPda.toBase58().slice(0, 8)}... TO your wallet.`,
        { id: 'claim', duration: 10000 }
      );
      console.log('✅✅✅ [SETTLEMENT COMPLETE] Balance increased:', {
        FROM_ESCROW_ACCOUNT: escrowPda.toBase58(),
        TO_REPLIER_WALLET: publicKey.toBase58(),
        AMOUNT: `${balanceIncrease / 1_000_000_000} SOL`,
        SIGNATURE: signature,
      });
      return true;
    }
    if (transactionDetails?.meta?.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(transactionDetails.meta.err)}`);
    }
    toast.warning(
      'Transaction confirmed but settlement pending. Please check transaction explorer.',
      { id: 'claim' }
    );
    return false;
  }

  try {
    const finalEscrowCheck = await connection.getAccountInfo(escrowPda);
    const finalReceiverBalance = await connection.getBalance(publicKey);
    const finalBalanceIncrease = finalReceiverBalance - receiverBalanceBefore;

    if (!finalEscrowCheck || finalEscrowCheck.owner.equals(SystemProgram.programId)) {
      toast.success(`✅ Settlement complete! ${finalBalanceIncrease / 1_000_000_000} SOL transferred.`, {
        id: 'claim',
      });
      return true;
    }
    if (finalBalanceIncrease > 0) {
      toast.success(`✅ Settlement complete! ${finalBalanceIncrease / 1_000_000_000} SOL received.`, {
        id: 'claim',
      });
      return true;
    }
  } catch {
    /* fall through to throw */
  }
  throw new Error(
    `Transaction confirmation timeout after ${maxAttempts} seconds. Please check transaction: ${explorerUrl}`
  );
}

// -----------------------------------------------------------------------------
// REPLY ESCROW LOGIC 5: Send email
// (Payload builder – actual mutation stays in composer)
// -----------------------------------------------------------------------------

export type SerializedAttachment = {
  name: string;
  type: string;
  base64: string;
  size: number;
  lastModified: number;
};

export interface PrepareSendEmailParamsOpts {
  toRecipients: { email: string; name?: string }[];
  ccRecipients?: { email: string; name?: string }[];
  bccRecipients?: { email: string; name?: string }[];
  subject: string;
  emailBody: string;
  attachments: SerializedAttachment[];
  fromEmail: string;
  draftId: string | undefined;
  replyToMessage: {
    messageId?: string;
    references?: string;
    threadId?: string;
    decodedBody?: string;
  };
  isForward: boolean;
}

/** 5) Build params for sendEmail mutation */
export function prepareSendEmailParams(opts: PrepareSendEmailParamsOpts) {
  const {
    toRecipients,
    ccRecipients,
    bccRecipients,
    subject,
    emailBody,
    attachments,
    fromEmail,
    draftId,
    replyToMessage,
    isForward,
  } = opts;

  return {
    to: toRecipients,
    cc: ccRecipients,
    bcc: bccRecipients,
    subject,
    message: emailBody,
    attachments,
    fromEmail,
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
    isForward,
    originalMessage: replyToMessage.decodedBody,
  };
}
