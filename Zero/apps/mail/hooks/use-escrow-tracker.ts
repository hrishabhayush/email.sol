import { useEffect, useRef, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, TransactionInstruction, SystemProgram } from '@solana/web3.js';
import { toast } from 'sonner';

const SOLMAIL_ESCROW_PROGRAM_ID = new PublicKey('Cx6XKyjVT5oipy3gdko2A7R4oJYc5ENUqgMapBF7zxkb');
const REGISTER_AND_CLAIM_DISCRIMINATOR = Uint8Array.from([127, 144, 210, 98, 66, 165, 255, 139]);

interface EscrowInfo {
  escrowPda: string;
  senderPubkey: string;
  threadIdHex: string;
  amount: number;
  status: 'pending' | 'claimed' | 'refunded';
}

/**
 * Hook to track escrow contracts and automatically claim when replies are detected
 * This monitors escrow accounts and automatically claims funds when a reply is sent
 */
export function useEscrowTracker() {
  const { connection } = useConnection();
  const { wallet, publicKey } = useWallet();
  const trackingRef = useRef<Map<string, EscrowInfo>>(new Map());
  const claimAttemptsRef = useRef<Map<string, number>>(new Map());

  /**
   * Claim escrow for a given thread
   */
  const claimEscrow = useCallback(async (
    senderPubkeyStr: string,
    threadIdHex: string,
    escrowPda: PublicKey
  ): Promise<boolean> => {
    if (!wallet?.adapter || !publicKey || !connection) {
      console.warn('[ESCROW TRACKER] Cannot claim: wallet not connected');
      return false;
    }

    const claimKey = `${senderPubkeyStr}-${threadIdHex}`;
    const attempts = claimAttemptsRef.current.get(claimKey) || 0;
    
    // Prevent infinite retry loops
    if (attempts >= 3) {
      console.warn('[ESCROW TRACKER] Max claim attempts reached, skipping:', claimKey);
      return false;
    }

    try {
      claimAttemptsRef.current.set(claimKey, attempts + 1);

      // Check escrow account status
      const escrowAccount = await connection.getAccountInfo(escrowPda);
      if (!escrowAccount || !escrowAccount.owner.equals(SOLMAIL_ESCROW_PROGRAM_ID)) {
        console.log('[ESCROW TRACKER] Escrow account not found or already claimed:', escrowPda.toBase58());
        return false;
      }

      // Parse escrow data to check status
      // Escrow account structure: [discriminator(8)] + [sender(32)] + [receiver(32)] + [thread_id(32)] + [amount(8)] + [created_at(8)] + [expires_at(8)] + [status(1)] + [bump(1)]
      const escrowData = escrowAccount.data;
      if (escrowData.length < 8 + 32 + 32 + 32 + 8 + 8 + 8 + 1 + 1) {
        console.warn('[ESCROW TRACKER] Invalid escrow account data length');
        return false;
      }

      // Check status (byte at position 8+32+32+32+8+8+8 = 120)
      const statusByte = escrowData[120];
      if (statusByte !== 0) { // 0 = Pending, 1 = Completed, 2 = Refunded
        console.log('[ESCROW TRACKER] Escrow already completed or refunded');
        return false;
      }

      console.log('[ESCROW TRACKER] Attempting to claim escrow:', {
        escrowPda: escrowPda.toBase58(),
        sender: senderPubkeyStr,
        threadId: threadIdHex,
        receiver: publicKey.toBase58(),
        attempts: attempts + 1,
      });

      // Convert hex string to Uint8Array
      const hashArray = new Uint8Array(32);
      for (let i = 0; i < 32; i++) {
        hashArray[i] = parseInt(threadIdHex.substring(i * 2, i * 2 + 2), 16);
      }

      const senderPubkey = new PublicKey(senderPubkeyStr);

      // Build register_and_claim instruction
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

      console.log('[ESCROW TRACKER] Sending claim transaction...');
      toast.loading('Auto-claiming escrow reward...', { id: `claim-${claimKey}` });

      const signature = await wallet.adapter.sendTransaction(transaction, connection, {
        skipPreflight: false,
        maxRetries: 3,
      });

      console.log('[ESCROW TRACKER] Claim transaction sent:', signature);

      // Wait for confirmation
      let confirmed = false;
      let attempts = 0;
      const maxAttempts = 30;

      while (!confirmed && attempts < maxAttempts) {
        try {
          const status = await connection.getSignatureStatus(signature);
          if (status?.value?.confirmationStatus === 'confirmed' || status?.value?.confirmationStatus === 'finalized') {
            confirmed = true;
            break;
          }
          if (status?.value?.err) {
            console.error('[ESCROW TRACKER] Transaction failed:', status.value.err);
            toast.error('Escrow claim transaction failed', { id: `claim-${claimKey}` });
            return false;
          }
          await new Promise((resolve) => setTimeout(resolve, 1000));
          attempts++;
        } catch (error) {
          console.error('[ESCROW TRACKER] Error checking transaction status:', error);
          attempts++;
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      if (confirmed) {
        console.log('[ESCROW TRACKER] ✅ Escrow claimed successfully!');
        toast.success('Escrow reward claimed!', { id: `claim-${claimKey}` });
        
        // Verify balance increased
        const newBalance = await connection.getBalance(publicKey);
        console.log('[ESCROW TRACKER] New balance:', newBalance / 1_000_000_000, 'SOL');
        
        // Clear claim attempts on success
        claimAttemptsRef.current.delete(claimKey);
        return true;
      } else {
        console.warn('[ESCROW TRACKER] Transaction confirmation timeout');
        toast.warning('Escrow claim pending confirmation...', { id: `claim-${claimKey}` });
        return false;
      }
    } catch (error) {
      console.error('[ESCROW TRACKER] Error claiming escrow:', error);
      toast.error(`Failed to claim escrow: ${error instanceof Error ? error.message : 'Unknown error'}`, { 
        id: `claim-${claimKey}` 
      });
      return false;
    }
  }, [wallet, publicKey, connection]);

  /**
   * Register an escrow to track
   */
  const trackEscrow = useCallback((info: EscrowInfo) => {
    const key = `${info.senderPubkey}-${info.threadIdHex}`;
    trackingRef.current.set(key, info);
    console.log('[ESCROW TRACKER] Registered escrow for tracking:', key);
  }, []);

  /**
   * Check and claim escrow for a thread when a reply is detected
   */
  const checkAndClaimEscrow = useCallback(async (
    senderPubkeyStr: string,
    threadIdHex: string
  ) => {
    if (!publicKey || !connection) return false;

    const encoder = new TextEncoder();
    const senderPubkey = new PublicKey(senderPubkeyStr);
    
    // Convert hex to Uint8Array
    const hashArray = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      hashArray[i] = parseInt(threadIdHex.substring(i * 2, i * 2 + 2), 16);
    }

    // Derive escrow PDA
    const [escrowPda] = PublicKey.findProgramAddressSync([
      encoder.encode('escrow'),
      senderPubkey.toBuffer(),
      hashArray,
    ], SOLMAIL_ESCROW_PROGRAM_ID);

    console.log('[ESCROW TRACKER] Checking escrow for reply:', {
      escrowPda: escrowPda.toBase58(),
      sender: senderPubkeyStr,
      threadId: threadIdHex,
      receiver: publicKey.toBase58(),
    });

    return await claimEscrow(senderPubkeyStr, threadIdHex, escrowPda);
  }, [publicKey, connection, claimEscrow]);

  return {
    trackEscrow,
    checkAndClaimEscrow,
    claimEscrow,
  };
}



