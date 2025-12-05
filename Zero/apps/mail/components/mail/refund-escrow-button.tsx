import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, TransactionInstruction, SystemProgram } from '@solana/web3.js';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useState } from 'react';

// SolMail Escrow program configuration
const SOLMAIL_ESCROW_PROGRAM_ID = new PublicKey('Cx6XKyjVT5oipy3gdko2A7R4oJYc5ENUqgMapBF7zxkb');
const REFUND_ESCROW_DISCRIMINATOR = Uint8Array.from([107, 186, 89, 99, 26, 194, 23, 204]);

interface RefundEscrowButtonProps {
  /** Subject of the email thread */
  subject: string;
  /** Sender's email (to derive thread_id) */
  senderEmail: string;
  /** Email message object to get headers from */
  emailMessage?: any;
  /** Optional className for styling */
  className?: string;
}

/**
 * Button component to refund escrowed funds after 15 days.
 * Only the sender can refund their own escrow.
 */
export function RefundEscrowButton({ subject, senderEmail, emailMessage, className }: RefundEscrowButtonProps) {
  const { wallet, publicKey } = useWallet();
  const { connection } = useConnection();
  const [isRefunding, setIsRefunding] = useState(false);

  const handleRefund = async () => {
    if (!wallet || !publicKey || !connection || !wallet.adapter) {
      toast.error('Please connect your Solana wallet to refund escrow');
      return;
    }

    try {
      setIsRefunding(true);
      toast.loading('Processing refund...', { id: 'refund' });

      const encoder = new TextEncoder();
      let hashArray: Uint8Array;

      // Get thread_id and sender pubkey from email headers (now stored directly in ParsedMessage.headers)
      const headers = (emailMessage as any)?.headers || {};
      
      console.log('[ESCROW LOG] Refund attempt started:', {
        timestamp: new Date().toISOString(),
        subject,
        senderEmail,
        messageId: (emailMessage as any)?.id,
        headerKeys: Object.keys(headers),
        allHeaders: headers,
        currentUser: publicKey.toBase58(),
      });
      
      // Try multiple header name variations (case-insensitive)
      const threadIdHex = headers['X-Solmail-Thread-Id'] || 
                         headers['x-solmail-thread-id'] ||
                         headers['X-SOLMAIL-THREAD-ID'] ||
                         headers['X-Solmail-Thread-ID'];
      const senderPubkeyStr = headers['X-Solmail-Sender-Pubkey'] || 
                              headers['x-solmail-sender-pubkey'] ||
                              headers['X-SOLMAIL-SENDER-PUBKEY'] ||
                              headers['X-Solmail-Sender-PUBKEY'];

      if (!threadIdHex || !senderPubkeyStr) {
        console.warn('[ESCROW LOG] Missing escrow headers:', {
          timestamp: new Date().toISOString(),
          hasThreadId: !!threadIdHex,
          hasSenderPubkey: !!senderPubkeyStr,
          headerKeys: Object.keys(headers),
          allHeaders: headers,
        });
        toast.error('Cannot refund: escrow headers not found in email. This email may not have an escrow.', { id: 'refund' });
        setIsRefunding(false);
        return;
      }

      // Convert hex string back to Uint8Array
      hashArray = new Uint8Array(32);
      for (let i = 0; i < 32; i++) {
        hashArray[i] = parseInt(threadIdHex.substring(i * 2, i * 2 + 2), 16);
      }
      
      // Get sender's pubkey (the one who created the escrow)
      const senderPubkey = new PublicKey(senderPubkeyStr);
      
      // Verify that the current user is the sender (only sender can refund)
      if (!publicKey.equals(senderPubkey)) {
        toast.error('Only the sender can refund their escrow', { id: 'refund' });
        setIsRefunding(false);
        return;
      }

      console.log('[ESCROW LOG] Using headers for refund:', {
        timestamp: new Date().toISOString(),
        threadIdHex,
        senderPubkey: senderPubkey.toBase58(),
        currentUser: publicKey.toBase58(),
        isSender: publicKey.equals(senderPubkey),
      });

      // Derive escrow PDA using sender's pubkey (same as when escrow was created)
      const [escrowPda] = PublicKey.findProgramAddressSync([
        encoder.encode('escrow'),
        senderPubkey.toBuffer(),
        hashArray,
      ], SOLMAIL_ESCROW_PROGRAM_ID);

      console.log('[ESCROW LOG] Checking escrow account:', {
        timestamp: new Date().toISOString(),
        escrowPda: escrowPda.toBase58(),
      });

      // Check if escrow account exists
      const escrowAccount = await connection.getAccountInfo(escrowPda);
      if (!escrowAccount || !escrowAccount.owner.equals(SOLMAIL_ESCROW_PROGRAM_ID)) {
        console.warn('[ESCROW LOG] Escrow account not found:', {
          timestamp: new Date().toISOString(),
          escrowPda: escrowPda.toBase58(),
          exists: !!escrowAccount,
          owner: escrowAccount?.owner.toBase58(),
          expectedOwner: SOLMAIL_ESCROW_PROGRAM_ID.toBase58(),
          derivationSeeds: {
            seed1: 'escrow',
            seed2: senderPubkey.toBase58(),
            seed3: Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join(''),
          },
        });
        toast.error('No escrow found for this thread', { id: 'refund' });
        setIsRefunding(false);
        return;
      }
      
      // Try to deserialize escrow account data to check status and expiration
      // Escrow account structure: [8-byte discriminator][32-byte sender][32-byte receiver][32-byte thread_id][8-byte amount][8-byte created_at][8-byte expires_at][1-byte status][1-byte bump]
      const accountData = escrowAccount.data;
      let escrowStatus = 'Unknown';
      let expiresAt = 0;
      let createdAt = 0;
      let escrowAmount = 0;
      
      if (accountData.length >= 8 + 32 + 32 + 32 + 8 + 8 + 8 + 1 + 1) {
        // Skip 8-byte discriminator, 32-byte sender, 32-byte receiver, 32-byte thread_id
        const amountOffset = 8 + 32 + 32 + 32;
        const createdAtOffset = amountOffset + 8;
        const expiresAtOffset = createdAtOffset + 8;
        const statusOffset = expiresAtOffset + 8;
        
        // Use DataView for reading binary data
        const dataView = new DataView(accountData.buffer, accountData.byteOffset, accountData.byteLength);
        
        // Read amount (u64, little-endian)
        escrowAmount = Number(dataView.getBigUint64(amountOffset, true));
        
        // Read created_at (i64, little-endian)
        createdAt = Number(dataView.getBigInt64(createdAtOffset, true));
        
        // Read expires_at (i64, little-endian)
        expiresAt = Number(dataView.getBigInt64(expiresAtOffset, true));
        
        // Read status (u8)
        const statusByte = accountData[statusOffset];
        escrowStatus = statusByte === 0 ? 'Pending' : statusByte === 1 ? 'Completed' : statusByte === 2 ? 'Refunded' : 'Unknown';
      }
      
      const now = Math.floor(Date.now() / 1000);
      const daysUntilExpiry = Math.max(0, expiresAt - now) / (24 * 60 * 60);
      const canRefund = expiresAt > 0 && now >= expiresAt;
      
      console.log('[ESCROW LOG] Escrow account found:', {
        timestamp: new Date().toISOString(),
        escrowPda: escrowPda.toBase58(),
        amount: `${escrowAccount.lamports / 1_000_000_000} SOL`,
        escrowAmount: `${escrowAmount / 1_000_000_000} SOL`,
        owner: escrowAccount.owner.toBase58(),
        status: escrowStatus,
        createdAt: new Date(createdAt * 1000).toISOString(),
        expiresAt: new Date(expiresAt * 1000).toISOString(),
        currentTime: new Date(now * 1000).toISOString(),
        daysUntilExpiry: daysUntilExpiry.toFixed(2),
        canRefund,
        isExpired: now >= expiresAt,
      });
      
      if (escrowStatus === 'Completed') {
        toast.error('Escrow has already been claimed by the receiver', { id: 'refund' });
        setIsRefunding(false);
        return;
      }
      
      if (escrowStatus === 'Refunded') {
        toast.error('Escrow has already been refunded', { id: 'refund' });
        setIsRefunding(false);
        return;
      }
      
      if (!canRefund) {
        toast.error(`Escrow cannot be refunded yet. ${daysUntilExpiry.toFixed(1)} days remaining.`, { id: 'refund' });
        setIsRefunding(false);
        return;
      }

      // Build refund_escrow instruction
      // Data: [8-byte discriminator][32-byte thread_id]
      const data = new Uint8Array(8 + 32);
      data.set(REFUND_ESCROW_DISCRIMINATOR, 0);
      data.set(hashArray, 8);

      const ix = new TransactionInstruction({
        programId: SOLMAIL_ESCROW_PROGRAM_ID,
        keys: [
          { pubkey: publicKey, isSigner: true, isWritable: true }, // sender
          { pubkey: escrowPda, isSigner: false, isWritable: true }, // escrow
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system program
        ],
        data,
      });

      const transaction = new Transaction().add(ix);
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      console.log('[ESCROW LOG] Sending refund transaction:', {
        timestamp: new Date().toISOString(),
        escrowPda: escrowPda.toBase58(),
        sender: publicKey.toBase58(),
        threadIdHex,
        dataLength: data.length,
        dataHex: Array.from(data).map(b => b.toString(16).padStart(2, '0')).join(''),
      });
      
      toast.loading('Please sign the refund transaction in your wallet...', { id: 'refund' });
      const signature = await wallet.adapter.sendTransaction(transaction, connection, {
        skipPreflight: false,
        maxRetries: 3,
      });
      
      console.log('[ESCROW LOG] Refund transaction sent:', {
        timestamp: new Date().toISOString(),
        signature,
        escrowPda: escrowPda.toBase58(),
      });

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
          await new Promise((resolve) => setTimeout(resolve, 1000));
          attempts++;
        } catch (error) {
          console.error('Error checking refund transaction status:', error);
          attempts++;
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      if (confirmed) {
        console.log('[ESCROW LOG] Refund successful:', {
          timestamp: new Date().toISOString(),
          signature,
          escrowPda: escrowPda.toBase58(),
          sender: publicKey.toBase58(),
        });
        toast.success('Escrow refunded successfully!', { id: 'refund' });
      } else {
        console.warn('[ESCROW LOG] Refund transaction timeout:', {
          timestamp: new Date().toISOString(),
          signature,
          escrowPda: escrowPda.toBase58(),
        });
        toast.error('Refund transaction timeout', { id: 'refund' });
      }
    } catch (error) {
      console.error('[ESCROW LOG] Error refunding escrow:', {
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        subject,
        senderEmail,
      });
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Refund failed: ${errorMessage}`, { id: 'refund' });
    } finally {
      setIsRefunding(false);
    }
  };

  return (
    <Button
      onClick={handleRefund}
      disabled={isRefunding || !wallet || !publicKey}
      variant="outline"
      size="sm"
      className={className}
      title={!wallet || !publicKey ? 'Connect your wallet to refund escrow' : 'Refund escrow after 15 days'}
    >
      {isRefunding ? 'Refunding...' : 'Refund Escrow'}
    </Button>
  );
}

