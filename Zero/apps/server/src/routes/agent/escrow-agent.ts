import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { Wallet as AnchorWallet } from '@coral-xyz/anchor';
import bs58 from 'bs58';
import { createSigner, type Signer, isSvmSignerWallet } from 'x402/types';
import { env } from '../../env';
import { scoreEmail } from './email-scoring-tool';
import { decide, type EscrowDecision } from './escrow-decision';
import {
  createEscrowAction,
  executeEscrowAction,
  calculateApiFee,
  type EscrowActionParams,
} from './escrow-actions';

/**
 * SendAI Escrow Agent
 * Automatically processes email replies, scores them, and triggers escrow decisions.
 */

// basic callback for streaming debugging/UI status updates
export interface StreamCallback {
  (step: string, data?: any): void;
}

export interface ProcessEmailReplyParams {
  emailContent: string;
  msgId: string;
  recipient?: PublicKey;
  amount?: number; // SOL amount to escrow
  streamCallback?: StreamCallback;
}

// result of email reply processing
export interface ProcessEmailReplyResult {
  success: boolean;
  score?: number;
  decision?: EscrowDecision;
  signature?: string;
  error?: string;
}

// global states
// allows read/write to the Solana blockchain
let connectionInstance: Connection | null = null;
// x402 signer for all wallet operations (created using x402's createSigner)
let x402SignerInstance: Signer | null = null;
// Cached keypair extracted from x402 signer for Anchor wallet operations
let cachedKeypair: Keypair | null = null;

/**
 * Get or create x402 signer from private key.
 * Uses x402's createSigner function to create a signer for all wallet operations.
 * This is the primary wallet interface - no solana-agent-kit involved.
 */
export async function getX402Signer(): Promise<Signer> {
  if (x402SignerInstance) {
    return x402SignerInstance;
  }

  const privateKey = env.SOLANA_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('SOLANA_PRIVATE_KEY is not set in environment variables');
  }

  // Convert private key to base58 string if needed
  // x402's createSigner expects base58 for SVM/Solana
  let privateKeyBase58: string;
  try {
    // Try parsing as JSON array first (format: [121,119,92,...])
    const parsed = JSON.parse(env.SOLANA_PRIVATE_KEY);
    if (Array.isArray(parsed)) {
      // Convert Uint8Array to base58
      privateKeyBase58 = bs58.encode(new Uint8Array(parsed));
    } else {
      // Assume it's already base58
      privateKeyBase58 = env.SOLANA_PRIVATE_KEY;
    }
  } catch {
    // If JSON parse fails, assume it's base58 encoded
    privateKeyBase58 = env.SOLANA_PRIVATE_KEY;
  }

  // Get network for x402 (solana or solana-devnet)
  const network = env.X402_NETWORK || 'solana-devnet';

  // Create signer using x402's createSigner - this is our wallet
  x402SignerInstance = await createSigner(network, privateKeyBase58);

  return x402SignerInstance;
}

/**
 * Get the keypair from x402 signer for Anchor wallet operations.
 * Extracts the keypair from the x402 signer to use with Anchor.
 */
async function getKeypairFromX402Signer(): Promise<Keypair> {
  if (cachedKeypair) {
    return cachedKeypair;
  }

  const signer = await getX402Signer();

  if (!isSvmSignerWallet(signer)) {
    throw new Error('Signer is not an SVM signer');
  }

  // x402's SvmSigner doesn't expose keypair directly
  // We need to recreate the keypair from the private key for Anchor operations
  // The x402 signer is used for x402 payments, keypair is used for Anchor transactions
  const privateKey = env.SOLANA_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('SOLANA_PRIVATE_KEY is not set');
  }

  let secretKey: Uint8Array;
  try {
    const parsed = JSON.parse(privateKey);
    if (Array.isArray(parsed)) {
      secretKey = new Uint8Array(parsed);
    } else {
      secretKey = bs58.decode(privateKey);
    }
  } catch {
    secretKey = bs58.decode(privateKey);
  }

  cachedKeypair = Keypair.fromSecretKey(secretKey);
  return cachedKeypair;
}

/**
 * Create an Anchor wallet from the keypair.
 * Uses the same keypair that x402 signer is based on, but signs directly with Keypair
 * for Anchor operations. x402 signer is used separately for x402 payment operations.
 */
async function getAnchorWalletFromX402Signer(): Promise<AnchorWallet> {
  const keypair = await getKeypairFromX402Signer();

  // Create Anchor wallet using the keypair directly
  // This uses the same private key as x402 signer but signs with Keypair for Anchor compatibility
  const anchorWallet: AnchorWallet = {
    publicKey: keypair.publicKey,
    payer: keypair,
    signTransaction: async (tx) => {
      // Sign directly with keypair for Anchor operations
      // Keypair implements Signer interface, use type assertion
      tx.sign(keypair as any);
      return tx;
    },
    signAllTransactions: async (txs) => {
      // Sign all transactions directly with keypair
      txs.forEach(tx => tx.sign(keypair as any));
      return txs;
    },
  };

  return anchorWallet;
}

/**
 * Get the connection instance.
 */

/**
 * Get the connection instance.
 */
export function getConnection(): Connection {
  if (!connectionInstance) {
    const rpcUrl = env.SOLANA_RPC_URL || 'https://solana-mainnet.g.alchemy.com/v2/3GHuEu4-cXEuE8jDAZW3EFgTedkyJ0K3';
    connectionInstance = new Connection(rpcUrl, 'confirmed');
  }
  return connectionInstance;
}

/**
 * Process an email reply: score it, decide, and execute escrow action.
 * This is the main entry point for the agent workflow.
 */
export async function processEmailReply(
  params: ProcessEmailReplyParams
): Promise<ProcessEmailReplyResult> {
  const { emailContent, msgId, recipient, amount, streamCallback } = params;

  const stream = (step: string, data?: any) => {
    if (streamCallback) {
      streamCallback(step, data);
    } else {
      console.log(`[EscrowAgent] ${step}`, data || '');
    }
  };

  try {
    stream('initializing', { msgId });

    // Initialize connection and get x402 signer (our wallet)
    const connection = getConnection();
    const x402Signer = await getX402Signer();

    // Create Anchor wallet adapter from x402 signer
    const anchorWallet = await getAnchorWalletFromX402Signer();

    stream('agent_initialized', { wallet: anchorWallet.publicKey.toString() });

    // Score the email using internal protected endpoint
    // x402 payment is handled automatically by email-scoring-tool.ts
    stream('scoring_email_start', { msgId });
    const scoringResult = await scoreEmail(emailContent);
    const score = scoringResult.score;
    stream('scoring_email_complete', { score, msgId });

    // Make decision based on score
    stream('making_decision_start', { score });
    const decision = decide(score);
    stream('making_decision_complete', { decision, score });

    // Ensure escrow exists
    stream('creating_escrow_start', { msgId, decision });

    // Calculate total amount and API fee
    const totalAmount = amount || 1; // Default 0.001 SOL (1M lamports)
    const feePercentage = parseFloat(env.X402_FEE_PERCENTAGE || '2');
    const apiFeeAmount = calculateApiFee(totalAmount, feePercentage);

    stream('api_fee_calculated', {
      totalAmount,
      apiFeeAmount,
      feePercentage,
      escrowAmount: totalAmount - apiFeeAmount
    });

    const escrowParams: EscrowActionParams = {
      msgId,
      amount: totalAmount,
      recipient,
      apiFeeAmount, // Pass API fee to be deducted from escrow
    };

    // Create escrow if it doesn't exist (idempotent)
    const createResult = await createEscrowAction(connection, anchorWallet, escrowParams);
    if (!createResult.success && createResult.error !== 'already_exists') {
      stream('creating_escrow_error', { error: createResult.error });
      return {
        success: false,
        score,
        decision,
        error: `Failed to create escrow: ${createResult.error}`,
      };
    }
    stream('creating_escrow_complete', {
      signature: createResult.signature,
      alreadyExists: createResult.signature === 'already_exists',
    });

    // Execute escrow action based on decision
    stream('executing_escrow_start', { decision, msgId });
    const executeResult = await executeEscrowAction(connection, anchorWallet, decision, escrowParams);

    if (!executeResult.success) {
      stream('executing_escrow_error', { error: executeResult.error });
      return {
        success: false,
        score,
        decision,
        error: `Failed to execute escrow action: ${executeResult.error}`,
      };
    }

    stream('executing_escrow_complete', {
      decision,
      signature: executeResult.signature,
    });

    stream('process_complete', {
      score,
      decision,
      signature: executeResult.signature,
    });

    return {
      success: true,
      score,
      decision,
      signature: executeResult.signature,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    stream('process_error', { error: errorMessage });
    console.error('[processEmailReply] Error:', error);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Create tools for the agent (for LangChain integration).
 * Note: This function is kept for compatibility but no longer uses solana-agent-kit.
 */
export function createEscrowAgentTools() {
  // Return tools array - can be extended with custom tools
  // x402 payment is handled automatically by email-scoring-tool.ts
  const tools = [
    {
      name: 'EMAIL_SCORING_ACTION',
      description: 'Score an email reply for quality (0-100)',
      execute: async (params: { emailContent: string }) => {
        return await scoreEmail(params.emailContent);
      },
    },
  ];

  return tools;
}

/**
 * Stream processing with async generator for real-time updates.
 */
export async function* processEmailReplyStream(
  params: ProcessEmailReplyParams
): AsyncGenerator<{ step: string; data?: any }, ProcessEmailReplyResult> {
  const streamCallback: StreamCallback = (step, data) => {
    // This will be handled by the generator yield
    // TODO: implement proper async generator
  };

  const result = await processEmailReply({
    ...params,
    streamCallback
  });

  return result;
}

