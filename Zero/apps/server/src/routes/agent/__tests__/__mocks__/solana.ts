import { vi } from 'vitest';
import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { KeypairWallet } from 'solana-agent-kit';

/**
 * Mock Solana Connection
 */
export function createMockConnection(): Connection {
    const connection = {
        getLatestBlockhash: vi.fn().mockResolvedValue({
            blockhash: 'mock-blockhash-123',
            lastValidBlockHeight: 1000,
        }),
        sendRawTransaction: vi.fn().mockResolvedValue('mock-transaction-signature-123'),
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
            // Sign the transaction properly
            tx.sign(keypair);
            return tx;
        }),
        signAllTransactions: vi.fn().mockImplementation(async (txs: Transaction[]) => {
            return txs.map(tx => {
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

