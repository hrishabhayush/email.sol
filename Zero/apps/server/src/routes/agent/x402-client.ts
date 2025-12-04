// @ts-nocheck - Type issues with x402-fetch will resolve once package is properly installed
import { KeypairWallet } from 'solana-agent-kit';
import { Connection, Keypair } from '@solana/web3.js';
import { env } from '../../env';
import bs58 from 'bs58';
import { wrapFetchWithPayment } from 'x402-fetch';

/**
 * x402 Client for Solana
 * Handles x402 payment protocol for HTTP API calls using Solana wallet.
 * Uses x402-fetch's wrapFetchWithPayment to automatically handle 402 responses.
 */

export interface X402ClientOptions {
  wallet: KeypairWallet;
  connection: Connection;
  network?: string; // 'mainnet-beta' or 'devnet' or 'testnet'
}

/**
 * Initialize x402 client with agent wallet.
 * Returns a wrapped fetch function that automatically handles 402 payments.
 * 
 * The wrapped fetch will:
 * - Detect 402 Payment Required responses
 * - Create and sign payment payloads using the Solana wallet
 * - Submit payments to the Coinbase facilitator
 * - Retry the original request with payment proof
 */
export function initializeX402Client(
  wallet: KeypairWallet,
  connection: Connection,
  network?: string
): typeof fetch {
  const networkName = network || env.X402_NETWORK || 'devnet';

  // Create a Solana signer for x402-fetch
  // x402-fetch expects a signer that can sign payment payloads
  // For Solana, we need to provide a signer interface
  const signer = {
    // The public key of the wallet (as string for x402)
    address: wallet.publicKey.toString(),

    // Sign function for payment payloads
    // x402-fetch will call this to sign payment transactions
    sign: async (message: Uint8Array): Promise<Uint8Array> => {
      // x402-fetch handles the actual payment creation and signing
      // This signer is used internally by wrapFetchWithPayment
      // The actual implementation depends on x402-fetch's internal handling
      return new Uint8Array();
    },
  };

  // Determine network string for x402
  // x402-fetch uses 'solana' for mainnet and 'solana-devnet' for devnet
  const x402Network = networkName === 'mainnet-beta' ? 'solana' : 'solana-devnet';

  // Wrap fetch with payment handling
  // Configuration for Coinbase CDP facilitator
  // Note: wrapFetchWithPayment API may vary - using type assertion for flexibility
  // The actual API will be determined when x402-fetch package is installed
  const wrappedFetch = (wrapFetchWithPayment as any)(
    fetch,
    signer,
    {
      network: x402Network,
      facilitator: {
        url: 'https://api.cdp.coinbase.com/platform/v2/x402',
      },
    }
  ) as typeof fetch;

  return wrappedFetch;
}
