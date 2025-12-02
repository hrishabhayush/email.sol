import { Connection, PublicKey, SystemProgram } from '@solana/web3.js';
import { Program, AnchorProvider, Wallet, BN } from '@coral-xyz/anchor';
import type { EscrowDecision } from './escrow-decision';

/**
 * Escrow actions for solana-agent-kit.
 * These actions interact with the Anchor escrow program.
 */

// Escrow program ID (placeholder - should match the deployed program)
const ESCROW_PROGRAM_ID = new PublicKey('Escrow1111111111111111111111111111111111111');

export interface EscrowActionParams {
  msgId: string;
  amount?: number; // Amount in lamports (optional, defaults to 0.001 SOL)
  recipient?: PublicKey; // Recipient public key (optional)
}

export interface EscrowActionResult {
  success: boolean;
  signature?: string;
  error?: string;
}

/**
 * Get the Anchor program instance for the escrow program.
 */
async function getEscrowProgram(connection: Connection, wallet: Wallet): Promise<Program> {
  // In a real implementation, you would load the IDL here
  // For now, we'll create a minimal program interface
  const provider = new AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
  });

  // This is a placeholder - in production, load the actual IDL
  const idl = {
    version: '0.1.0',
    name: 'escrow',
    instructions: [
      {
        name: 'createEscrow',
        accounts: [
          { name: 'escrow', isMut: true, isSigner: false },
          { name: 'sender', isMut: true, isSigner: true },
          { name: 'systemProgram', isMut: false, isSigner: false },
        ],
        args: [
          { name: 'msgId', type: 'string' },
          { name: 'amount', type: 'u64' },
          { name: 'recipient', type: 'publicKey' },
        ],
      },
      {
        name: 'release',
        accounts: [
          { name: 'escrow', isMut: true, isSigner: false },
          { name: 'recipient', isMut: true, isSigner: false },
          { name: 'systemProgram', isMut: false, isSigner: false },
        ],
        args: [],
      },
      {
        name: 'withhold',
        accounts: [
          { name: 'escrow', isMut: true, isSigner: false },
          { name: 'sender', isMut: true, isSigner: false },
          { name: 'systemProgram', isMut: false, isSigner: false },
        ],
        args: [],
      },
    ],
    accounts: [
      {
        name: 'EscrowAccount',
        type: {
          kind: 'struct',
          fields: [
            { name: 'msgId', type: 'string' },
            { name: 'amount', type: 'u64' },
            { name: 'sender', type: 'publicKey' },
            { name: 'recipient', type: 'publicKey' },
            { name: 'status', type: { defined: 'EscrowStatus' } },
            { name: 'bump', type: 'u8' },
          ],
        },
      },
    ],
  };

  return new Program(idl as any, ESCROW_PROGRAM_ID, provider);
}

/**
 * Find the escrow PDA for a given message ID.
 */
function findEscrowPDA(msgId: string, programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('escrow'), Buffer.from(msgId)],
    programId
  );
}

/**
 * Create or ensure escrow exists for a message.
 */
export async function createEscrowAction(
  connection: Connection,
  wallet: Wallet,
  params: EscrowActionParams
): Promise<EscrowActionResult> {
  try {
    const program = await getEscrowProgram(connection, wallet);
    const [escrowPDA] = findEscrowPDA(params.msgId, ESCROW_PROGRAM_ID);
    
    const amount = params.amount || 1_000_000; // Default 0.001 SOL (1M lamports)
    const recipient = params.recipient || wallet.publicKey; // Default to wallet if not provided

    // Check if escrow already exists
    try {
      const escrowAccount = await program.account.escrowAccount.fetch(escrowPDA);
      if (escrowAccount) {
        return { success: true, signature: 'already_exists' };
      }
    } catch (error) {
      // Escrow doesn't exist, continue to create
    }

    // Create escrow transaction
    const tx = await program.methods
      .createEscrow(params.msgId, new BN(amount), recipient)
      .accounts({
        escrow: escrowPDA,
        sender: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return { success: true, signature: tx };
  } catch (error) {
    console.error('[createEscrowAction] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Release escrow funds to recipient.
 */
export async function releaseEscrowAction(
  connection: Connection,
  wallet: Wallet,
  params: EscrowActionParams
): Promise<EscrowActionResult> {
  try {
    const program = await getEscrowProgram(connection, wallet);
    const [escrowPDA] = findEscrowPDA(params.msgId, ESCROW_PROGRAM_ID);

    // Fetch escrow account to get recipient
    const escrowAccount = await program.account.escrowAccount.fetch(escrowPDA);
    const recipient = new PublicKey(escrowAccount.recipient);

    // Release escrow transaction
    const tx = await program.methods
      .release()
      .accounts({
        escrow: escrowPDA,
        recipient: recipient,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return { success: true, signature: tx };
  } catch (error) {
    console.error('[releaseEscrowAction] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Withhold escrow funds (return to sender).
 */
export async function withholdEscrowAction(
  connection: Connection,
  wallet: Wallet,
  params: EscrowActionParams
): Promise<EscrowActionResult> {
  try {
    const program = await getEscrowProgram(connection, wallet);
    const [escrowPDA] = findEscrowPDA(params.msgId, ESCROW_PROGRAM_ID);

    // Fetch escrow account to get sender
    const escrowAccount = await program.account.escrowAccount.fetch(escrowPDA);
    const sender = new PublicKey(escrowAccount.sender);

    // Withhold escrow transaction
    const tx = await program.methods
      .withhold()
      .accounts({
        escrow: escrowPDA,
        sender: sender,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return { success: true, signature: tx };
  } catch (error) {
    console.error('[withholdEscrowAction] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Execute escrow action based on decision.
 */
export async function executeEscrowAction(
  connection: Connection,
  wallet: Wallet,
  decision: EscrowDecision,
  params: EscrowActionParams
): Promise<EscrowActionResult> {
  if (decision === 'RELEASE') {
    return releaseEscrowAction(connection, wallet, params);
  } else {
    return withholdEscrowAction(connection, wallet, params);
  }
}

