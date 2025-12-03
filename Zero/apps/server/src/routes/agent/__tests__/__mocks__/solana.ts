import { vi } from 'vitest';
import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { KeypairWallet } from 'solana-agent-kit';

/**
 * Mock Solana Connection
 */
export function createMockConnection(): Connection {
    // Use a valid base58 blockhash (Solana blockhashes are base58 encoded)
    const validBlockhash = 'EkSnNWid2cvwEVnVx9aBqawnmiCNiDgp3gUdkDPTb1iN';
    const connection = {
        getLatestBlockhash: vi.fn().mockResolvedValue({
            blockhash: validBlockhash,
            lastValidBlockHeight: 1000,
        }),
        sendRawTransaction: vi.fn().mockImplementation(async (serializedTx: Buffer | Uint8Array) => {
            // Verify transaction can be serialized (just return mock signature)
            return 'mock-transaction-signature-123';
        }),
        confirmTransaction: vi.fn().mockResolvedValue({
            value: { err: null },
        }),
    } as unknown as Connection;

    return connection;
}

/**
 * Mock KeypairWallet
 */
export function createMockKeypairWallet(): KeypairWallet {
    const keypair = Keypair.generate();

    const wallet = {
        publicKey: keypair.publicKey,
        signTransaction: vi.fn().mockImplementation(async (tx: Transaction) => {
            // Ensure transaction has required properties before signing
            // Use a valid base58 blockhash
            const validBlockhash = 'EkSnNWid2cvwEVnVx9aBqawnmiCNiDgp3gUdkDPTb1iN';
            if (!tx.recentBlockhash) {
                tx.recentBlockhash = validBlockhash;
            }
            if (!tx.feePayer) {
                tx.feePayer = keypair.publicKey;
            }
            // Sign the transaction - this modifies the transaction in place
            tx.sign(keypair);
            return tx;
        }),
        signAllTransactions: vi.fn().mockImplementation(async (txs: Transaction[]) => {
            const validBlockhash = 'EkSnNWid2cvwEVnVx9aBqawnmiCNiDgp3gUdkDPTb1iN';
            return txs.map(tx => {
                if (!tx.recentBlockhash) {
                    tx.recentBlockhash = validBlockhash;
                }
                if (!tx.feePayer) {
                    tx.feePayer = keypair.publicKey;
                }
                tx.sign(keypair);
                return tx;
            });
        }),
    } as unknown as KeypairWallet;

    return wallet;
}

/**
 * Mock PublicKey
 */
export function createMockPublicKey(address?: string): PublicKey {
    return new PublicKey(address || '11111111111111111111111111111111');
}

