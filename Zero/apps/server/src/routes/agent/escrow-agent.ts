import { SolanaAgentKit, KeypairWallet, createLangchainTools } from 'solana-agent-kit';
import TokenPlugin from '@solana-agent-kit/plugin-token';
import { Keypair, Connection, PublicKey } from '@solana/web3.js';
import { Wallet as AnchorWallet } from '@coral-xyz/anchor';
import bs58 from 'bs58';
import { env } from '../../env';
import { scoreEmail } from './email-scoring-tool';
import { decide, type EscrowDecision } from './escrow-decision';
import {
  createEscrowAction,
  executeEscrowAction,
  type EscrowActionParams,
} from './escrow-actions';
import { EmailScoringTool } from './email-scoring-tool';

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
  originalEmailContent?: string;
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
// wrapped in SolanaAgentKit instance to access the wallet and connection and integrate with Agent
let agentInstance: SolanaAgentKit | null = null;
// allows read/write to the Solana blockchain
let connectionInstance: Connection | null = null;

/**
 * Initialize the SendAI agent with wallet and plugins.
 */
export function initializeEscrowAgent(): SolanaAgentKit {
  if (agentInstance) {
    return agentInstance;
  }

  try {
    // Create keypair from private key
    const privateKey = env.SOLANA_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('SOLANA_PRIVATE_KEY is not set in environment variables');
    }

    const keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
    const wallet = new KeypairWallet(keypair);

    // Create connection
    const rpcUrl = env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    connectionInstance = new Connection(rpcUrl, 'confirmed');

    // Initialize agent
    agentInstance = new SolanaAgentKit(wallet, rpcUrl, {
      OPENAI_API_KEY: env.OPENAI_API_KEY,
    }).use(TokenPlugin);

    return agentInstance;
  } catch (error) {
    console.error('[initializeEscrowAgent] Error:', error);
    throw new Error(
      `Failed to initialize escrow agent: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get the agent instance, initializing if necessary.
 */
export function getEscrowAgent(): SolanaAgentKit {
  return initializeEscrowAgent();
}

/**
 * Get the connection instance.
 */
export function getConnection(): Connection {
  if (!connectionInstance) {
    const rpcUrl = env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
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
  const { emailContent, originalEmailContent, msgId, recipient, amount, streamCallback } = params;

  const stream = (step: string, data?: any) => {
    if (streamCallback) {
      streamCallback(step, data);
    } else {
      console.log(`[EscrowAgent] ${step}`, data || '');
    }
  };

  try {
    stream('initializing', { msgId });

    // Initialize agent and connection
    const agent = getEscrowAgent();
    const connection = getConnection();
    const keypairWallet = agent.wallet as KeypairWallet;

    // Convert KeypairWallet to Anchor Wallet -> for smart contract interactions
    const anchorWallet: AnchorWallet = {
      publicKey: keypairWallet.publicKey,
      signTransaction: async (tx) => {
        return await keypairWallet.signTransaction(tx);
      },
      signAllTransactions: async (txs) => {
        return await keypairWallet.signAllTransactions(txs);
      },
    };

    stream('agent_initialized', { wallet: anchorWallet.publicKey.toString() });

    // Score the email using LLM
    stream('scoring_email_start', { msgId });
    const scoringResult = await scoreEmail(emailContent, originalEmailContent);
    const score = scoringResult.score;
    stream('scoring_email_complete', { score, msgId });

    // Make decision based on score
    stream('making_decision_start', { score });
    const decision = decide(score);
    stream('making_decision_complete', { decision, score });

    // Ensure escrow exists
    stream('creating_escrow_start', { msgId, decision });
    const escrowParams: EscrowActionParams = {
      msgId,
      amount: amount || 1_000_000, // TODO: change? Default 0.001 SOL
      recipient,
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
 */
export function createEscrowAgentTools() {
  const agent = getEscrowAgent();

  // Registers tools with agent -> allows agent to dynamically call during workflow
  const tools = createLangchainTools(agent, [
    ...agent.actions, // existing actions from solana-agent-kit
    // Add custom email scoring tool as an action
    {
      name: 'EMAIL_SCORING_ACTION',
      description: 'Score an email reply for quality (0-100)',
      // execute function is called when the tool is invoked by the agent
      execute: async (params: { emailContent: string }) => {
        const result = await scoreEmail(params.emailContent);
        return result;
      },
    },
  ]);

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

