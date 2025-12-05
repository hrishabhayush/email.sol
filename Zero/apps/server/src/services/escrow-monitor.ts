/**
 * Escrow Monitor Service
 * 
 * Monitors escrow contracts on Solana mainnet and automatically claims
 * escrow when replies are detected. This runs as a background service
 * to ensure escrow settlements happen reliably.
 */

import { Connection, PublicKey, Transaction, TransactionInstruction, SystemProgram } from '@solana/web3.js';
import { env } from '../env';

const SOLMAIL_ESCROW_PROGRAM_ID = new PublicKey('Cx6XKyjVT5oipy3gdko2A7R4oJYc5ENUqgMapBF7zxkb');
const REGISTER_AND_CLAIM_DISCRIMINATOR = Uint8Array.from([127, 144, 210, 98, 66, 165, 255, 139]);

interface EscrowInfo {
  escrowPda: string;
  senderPubkey: string;
  threadIdHex: string;
  receiverPubkey: string;
  amount: number;
  createdAt: number;
}

interface PendingClaim {
  escrowInfo: EscrowInfo;
  lastAttempt: number;
  attempts: number;
}

export class EscrowMonitor {
  private connection: Connection;
  private pendingClaims: Map<string, PendingClaim> = new Map();
  private monitoringInterval: number | null = null;
  private readonly MAX_ATTEMPTS = 5;
  private readonly RETRY_DELAY = 30000; // 30 seconds

  constructor() {
    // Use mainnet RPC endpoint
    // Default to Alchemy mainnet endpoint (same as client)
    const rpcUrl = process.env.SOLANA_RPC_URL || 
                   'https://solana-mainnet.g.alchemy.com/v2/3GHuEu4-cXEuE8jDAZW3EFgTedkyJ0K3';
    this.connection = new Connection(rpcUrl, 'confirmed');
    console.log('[ESCROW MONITOR] Initialized with RPC:', rpcUrl);
  }

  /**
   * Register an escrow to monitor and claim
   */
  registerEscrow(info: EscrowInfo) {
    const key = `${info.senderPubkey}-${info.threadIdHex}`;
    this.pendingClaims.set(key, {
      escrowInfo: info,
      lastAttempt: 0,
      attempts: 0,
    });
    console.log('[ESCROW MONITOR] Registered escrow for monitoring:', {
      key,
      escrowPda: info.escrowPda,
      sender: info.senderPubkey,
      receiver: info.receiverPubkey,
      amount: `${info.amount / 1_000_000_000} SOL`,
    });
  }

  /**
   * Start monitoring escrow contracts
   */
  startMonitoring() {
    if (this.monitoringInterval) {
      console.warn('[ESCROW MONITOR] Monitoring already started');
      return;
    }

    console.log('[ESCROW MONITOR] Starting escrow monitoring service...');
    
    // Check pending claims every 30 seconds
    this.monitoringInterval = setInterval(() => {
      this.processPendingClaims().catch((error) => {
        console.error('[ESCROW MONITOR] Error processing pending claims:', error);
      });
    }, this.RETRY_DELAY) as unknown as number;

    // Process immediately
    this.processPendingClaims().catch((error) => {
      console.error('[ESCROW MONITOR] Error in initial claim processing:', error);
    });
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('[ESCROW MONITOR] Stopped monitoring');
    }
  }

  /**
   * Process all pending claims
   */
  private async processPendingClaims() {
    const now = Date.now();
    const claimsToProcess: PendingClaim[] = [];

    for (const [key, claim] of this.pendingClaims.entries()) {
      // Skip if too many attempts
      if (claim.attempts >= this.MAX_ATTEMPTS) {
        console.warn('[ESCROW MONITOR] Max attempts reached, removing:', key);
        this.pendingClaims.delete(key);
        continue;
      }

      // Skip if recently attempted
      if (now - claim.lastAttempt < this.RETRY_DELAY) {
        continue;
      }

      claimsToProcess.push(claim);
    }

    if (claimsToProcess.length === 0) {
      return;
    }

    console.log(`[ESCROW MONITOR] Processing ${claimsToProcess.length} pending claims...`);

    for (const claim of claimsToProcess) {
      await this.attemptClaim(claim);
    }
  }

  /**
   * Attempt to claim an escrow
   * Note: This requires the receiver's wallet to sign, so this is mainly
   * for tracking and verification. Actual claiming happens client-side.
   */
  private async attemptClaim(claim: PendingClaim) {
    const { escrowInfo } = claim;
    const key = `${escrowInfo.senderPubkey}-${escrowInfo.threadIdHex}`;

    try {
      claim.lastAttempt = Date.now();
      claim.attempts++;

      const escrowPda = new PublicKey(escrowInfo.escrowPda);
      const escrowAccount = await this.connection.getAccountInfo(escrowPda);

      if (!escrowAccount || !escrowAccount.owner.equals(SOLMAIL_ESCROW_PROGRAM_ID)) {
        console.log('[ESCROW MONITOR] Escrow account not found or already claimed:', escrowPda.toBase58());
        this.pendingClaims.delete(key);
        return;
      }

      // Parse escrow status
      const escrowData = escrowAccount.data;
      if (escrowData.length < 121) {
        console.warn('[ESCROW MONITOR] Invalid escrow account data');
        return;
      }

      const statusByte = escrowData[120];
      if (statusByte !== 0) {
        // 0 = Pending, 1 = Completed, 2 = Refunded
        console.log('[ESCROW MONITOR] Escrow already completed or refunded:', {
          status: statusByte === 1 ? 'Completed' : 'Refunded',
          escrowPda: escrowPda.toBase58(),
        });
        this.pendingClaims.delete(key);
        return;
      }

      console.log('[ESCROW MONITOR] Escrow still pending, waiting for client-side claim:', {
        escrowPda: escrowPda.toBase58(),
        sender: escrowInfo.senderPubkey,
        receiver: escrowInfo.receiverPubkey,
        amount: `${escrowInfo.amount / 1_000_000_000} SOL`,
        attempts: claim.attempts,
      });

      // Verify escrow details match
      // This is just for logging - actual claim happens client-side with wallet signature
    } catch (error) {
      console.error('[ESCROW MONITOR] Error checking escrow:', error);
    }
  }

  /**
   * Verify an escrow was successfully claimed
   */
  async verifyClaim(escrowPda: string, receiverPubkey: string): Promise<boolean> {
    try {
      const pda = new PublicKey(escrowPda);
      const account = await this.connection.getAccountInfo(pda);

      if (!account) {
        // Account closed = successfully claimed
        console.log('[ESCROW MONITOR] ✅ Escrow account closed - claim successful');
        return true;
      }

      if (!account.owner.equals(SOLMAIL_ESCROW_PROGRAM_ID)) {
        console.log('[ESCROW MONITOR] ✅ Escrow account ownership changed - claim successful');
        return true;
      }

      // Check status
      const escrowData = account.data;
      if (escrowData.length >= 121) {
        const statusByte = escrowData[120];
        if (statusByte === 1) {
          // Completed
          console.log('[ESCROW MONITOR] ✅ Escrow status: Completed');
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('[ESCROW MONITOR] Error verifying claim:', error);
      return false;
    }
  }

  /**
   * Get escrow account info
   */
  async getEscrowInfo(escrowPda: string) {
    try {
      const pda = new PublicKey(escrowPda);
      const account = await this.connection.getAccountInfo(pda);

      if (!account || !account.owner.equals(SOLMAIL_ESCROW_PROGRAM_ID)) {
        return null;
      }

      const data = account.data;
      if (data.length < 121) {
        return null;
      }

      // Parse escrow data
      const sender = new PublicKey(data.slice(8, 40));
      const receiver = new PublicKey(data.slice(40, 72));
      const threadId = Array.from(data.slice(72, 104));
      const amount = data.readBigUInt64LE(104);
      const createdAt = Number(data.readBigInt64LE(112));
      const statusByte = data[120];

      return {
        sender: sender.toBase58(),
        receiver: receiver.toBase58(),
        threadId: Buffer.from(threadId).toString('hex'),
        amount: Number(amount),
        createdAt,
        status: statusByte === 0 ? 'Pending' : statusByte === 1 ? 'Completed' : 'Refunded',
        lamports: account.lamports,
      };
    } catch (error) {
      console.error('[ESCROW MONITOR] Error getting escrow info:', error);
      return null;
    }
  }
}

// Singleton instance
let escrowMonitorInstance: EscrowMonitor | null = null;

export function getEscrowMonitor(): EscrowMonitor {
  if (!escrowMonitorInstance) {
    escrowMonitorInstance = new EscrowMonitor();
  }
  return escrowMonitorInstance;
}



