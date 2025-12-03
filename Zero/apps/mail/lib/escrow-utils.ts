import { Connection, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import BN from 'bn.js';
import { ESCROW_PROGRAM_ID, PLATFORM_WALLET } from './escrow-client';
import idl from './escrow_contract.json';
import { Wallet } from '@solana/wallet-adapter-base';

// Constants
export const LAMPORTS_PER_SOL = 1_000_000_000;
export const PLATFORM_FEE_PERCENTAGE = 2; // 2%
export const ESCROW_EXPIRY_DAYS = 30;
export const SECONDS_PER_DAY = 86400;

// Escrow status enum (matching contract)
export enum EscrowStatus {
  Pending = 'Pending',
  Released = 'Released',
  Refunded = 'Refunded',
}

// Escrow account data structure
export interface EscrowAccountData {
  sender: PublicKey;
  recipient: PublicKey;
  platform: PublicKey;
  amount: BN;
  emailId: string;
  status: EscrowStatus;
  createdAt: BN;
  expiresAt: BN;
  bump: number;
}

/**
 * Convert SOL amount to lamports
 */
export function solToLamports(sol: number): BN {
  return new BN(Math.floor(sol * LAMPORTS_PER_SOL));
}

/**
 * Convert lamports to SOL amount
 */
export function lamportsToSol(lamports: BN | number): number {
  const lamportsNum = typeof lamports === 'number' ? lamports : lamports.toNumber();
  return lamportsNum / LAMPORTS_PER_SOL;
}

/**
 * Calculate platform fee (2% of amount)
 */
export function calculatePlatformFee(amountInLamports: BN): BN {
  // 2% = amount * 2 / 100
  return amountInLamports.mul(new BN(2)).div(new BN(100));
}

/**
 * Calculate amount after platform fee
 */
export function calculateAmountAfterFee(amountInLamports: BN): BN {
  const fee = calculatePlatformFee(amountInLamports);
  return amountInLamports.sub(fee);
}

/**
 * Get escrow PDA (Program Derived Address) from emailId and sender
 */
export function getEscrowPda(emailId: string, sender: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('escrow'),
      Buffer.from(emailId),
      sender.toBuffer(),
    ],
    ESCROW_PROGRAM_ID
  );
  return pda;
}

/**
 * Fetch escrow account data from the blockchain
 */
export async function fetchEscrowAccount(
  connection: Connection,
  emailId: string,
  sender: PublicKey
): Promise<EscrowAccountData | null> {
  try {
    const escrowPda = getEscrowPda(emailId, sender);
    
    // Create a minimal provider for read-only operations
    const provider = new AnchorProvider(
      connection,
      {
        publicKey: PublicKey.default,
        signTransaction: async () => {
          throw new Error('Read-only operation');
        },
        signAllTransactions: async () => {
          throw new Error('Read-only operation');
        },
      } as any,
      AnchorProvider.defaultOptions()
    );

    const program = new Program(idl as any, ESCROW_PROGRAM_ID, provider);
    
    const escrowAccount = await program.account.escrow.fetch(escrowPda);
    
    if (!escrowAccount) {
      return null;
    }

    // Map the account data to our interface
    return {
      sender: new PublicKey(escrowAccount.sender),
      recipient: new PublicKey(escrowAccount.recipient),
      platform: new PublicKey(escrowAccount.platform),
      amount: escrowAccount.amount as BN,
      emailId: escrowAccount.emailId as string,
      status: escrowAccount.status as EscrowStatus,
      createdAt: escrowAccount.createdAt as BN,
      expiresAt: escrowAccount.expiresAt as BN,
      bump: escrowAccount.bump as number,
    };
  } catch (error) {
    // Account doesn't exist or other error
    if (error instanceof Error && error.message.includes('AccountNotInitialized')) {
      return null;
    }
    console.error('Error fetching escrow account:', error);
    return null;
  }
}

/**
 * Check if escrow has expired (30 days)
 */
export function isEscrowExpired(expiresAt: BN): boolean {
  const currentTimestamp = new BN(Math.floor(Date.now() / 1000));
  return currentTimestamp.gte(expiresAt);
}

/**
 * Check if escrow can be refunded
 * Conditions: expired (30 days) or invalid recipient
 */
export function canRefundEscrow(escrowData: EscrowAccountData): {
  canRefund: boolean;
  reason?: string;
} {
  if (escrowData.status === EscrowStatus.Refunded) {
    return { canRefund: false, reason: 'Escrow already refunded' };
  }

  if (escrowData.status === EscrowStatus.Released) {
    return { canRefund: false, reason: 'Escrow already released' };
  }

  if (isEscrowExpired(escrowData.expiresAt)) {
    return { canRefund: true, reason: 'Escrow expired (30 days)' };
  }

  return { canRefund: false, reason: 'Escrow is still active' };
}

/**
 * Format SOL amount for display
 */
export function formatSolAmount(sol: number, decimals: number = 6): string {
  return sol.toFixed(decimals);
}

/**
 * Format lamports as SOL for display
 */
export function formatLamportsAsSol(lamports: BN | number, decimals: number = 6): string {
  const sol = lamportsToSol(lamports);
  return formatSolAmount(sol, decimals);
}

/**
 * Get time remaining until escrow expires
 */
export function getTimeUntilExpiry(expiresAt: BN): {
  days: number;
  hours: number;
  minutes: number;
  expired: boolean;
} {
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const expiresTimestamp = expiresAt.toNumber();
  const diff = expiresTimestamp - currentTimestamp;

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, expired: true };
  }

  const days = Math.floor(diff / SECONDS_PER_DAY);
  const hours = Math.floor((diff % SECONDS_PER_DAY) / 3600);
  const minutes = Math.floor((diff % 3600) / 60);

  return { days, hours, minutes, expired: false };
}

/**
 * Format time until expiry as human-readable string
 */
export function formatTimeUntilExpiry(expiresAt: BN): string {
  const time = getTimeUntilExpiry(expiresAt);
  
  if (time.expired) {
    return 'Expired';
  }

  if (time.days > 0) {
    return `${time.days} day${time.days !== 1 ? 's' : ''} remaining`;
  }

  if (time.hours > 0) {
    return `${time.hours} hour${time.hours !== 1 ? 's' : ''} remaining`;
  }

  return `${time.minutes} minute${time.minutes !== 1 ? 's' : ''} remaining`;
}

/**
 * Validate email ID format
 */
export function isValidEmailId(emailId: string): boolean {
  // Basic validation - should be non-empty and reasonable length
  return emailId.length > 0 && emailId.length <= 256;
}

/**
 * Validate Solana public key address
 */
export function isValidPublicKey(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get block explorer URL for a transaction
 */
export function getTransactionExplorerUrl(signature: string, cluster: 'mainnet-beta' | 'devnet' | 'testnet' = 'mainnet-beta'): {
  solscan: string;
  solanaExplorer: string;
} {
  const baseUrl = cluster === 'mainnet-beta' ? '' : `?cluster=${cluster}`;
  return {
    solscan: `https://solscan.io/tx/${signature}${cluster !== 'mainnet-beta' ? `?cluster=${cluster}` : ''}`,
    solanaExplorer: `https://explorer.solana.com/tx/${signature}${baseUrl}`,
  };
}

/**
 * Get block explorer URL for an account
 */
export function getAccountExplorerUrl(address: string, cluster: 'mainnet-beta' | 'devnet' | 'testnet' = 'mainnet-beta'): {
  solscan: string;
  solanaExplorer: string;
} {
  const baseUrl = cluster === 'mainnet-beta' ? '' : `?cluster=${cluster}`;
  return {
    solscan: `https://solscan.io/account/${address}${cluster !== 'mainnet-beta' ? `?cluster=${cluster}` : ''}`,
    solanaExplorer: `https://explorer.solana.com/address/${address}${baseUrl}`,
  };
}

/**
 * Calculate escrow breakdown (amount, fee, recipient gets)
 */
export function calculateEscrowBreakdown(amountInSol: number): {
  totalAmount: string;
  platformFee: string;
  recipientAmount: string;
  totalAmountLamports: BN;
  platformFeeLamports: BN;
  recipientAmountLamports: BN;
} {
  const totalAmountLamports = solToLamports(amountInSol);
  const platformFeeLamports = calculatePlatformFee(totalAmountLamports);
  const recipientAmountLamports = calculateAmountAfterFee(totalAmountLamports);

  return {
    totalAmount: formatSolAmount(amountInSol),
    platformFee: formatLamportsAsSol(platformFeeLamports),
    recipientAmount: formatLamportsAsSol(recipientAmountLamports),
    totalAmountLamports,
    platformFeeLamports,
    recipientAmountLamports,
  };
}

/**
 * Check if an address is the platform wallet
 */
export function isPlatformWallet(address: PublicKey | string): boolean {
  const addressStr = typeof address === 'string' ? address : address.toString();
  return addressStr === PLATFORM_WALLET.toString();
}

