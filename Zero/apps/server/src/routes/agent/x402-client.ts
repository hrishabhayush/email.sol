import { KeypairWallet } from 'solana-agent-kit';
import { Connection, Transaction, SystemProgram, PublicKey, Keypair } from '@solana/web3.js';
import { env } from '../../env';
import bs58 from 'bs58';

/**
 * x402 Client for Solana
 * Handles x402 payment protocol for HTTP API calls using Solana wallet.
 * 
 * x402 Protocol:
 * - API returns 402 Payment Required with payment headers
 * - Client processes payment and retries request with payment proof
 */

export interface X402PaymentResponse {
  amount: string;
  recipient: string;
  network: string;
  token?: string;
  message?: string;
}

export interface X402ClientOptions {
  wallet: KeypairWallet;
  connection: Connection;
  network?: string; // 'mainnet-beta' or 'devnet' or 'testnet'
}

/**
 * Parse x402 payment response from HTTP headers.
 */
function parseX402PaymentResponse(headers: Headers): X402PaymentResponse | null {
  const paymentHeader = headers.get('x-payment-response');
  if (!paymentHeader) {
    return null;
  }

  try {
    // x402 payment response is typically JSON in the header
    const decoded = decodeURIComponent(paymentHeader);
    /* parses into response like this:
    {
    "status": "success",         // Was the payment successful?
    "fee": 250000,               // cost of that single API call
    "txSignature": "5G8d...abc"  // Solana transaction signature for the payment
    ...
    }
    */
    return JSON.parse(decoded) as X402PaymentResponse;
  } catch (error) {
    console.error('[x402] Failed to parse payment response:', error);
    return null;
  }
}

/**
 * Create x402 payment transaction on Solana.
 * This is a simplified version - in production, you'd need to integrate
 * with the actual x402 payment facilitator contract.
 */
async function createX402Payment(
  connection: Connection,
  wallet: KeypairWallet,
  paymentInfo: X402PaymentResponse
): Promise<string> {
  try {
    // Parse recipient address
    const recipientPubkey = new PublicKey(paymentInfo.recipient);
    
    // Parse amount (assuming it's in lamports or SOL)
    // x402 amounts are typically in smallest unit (lamports for SOL)
    const amount = parseFloat(paymentInfo.amount);
    const lamports = Math.floor(amount * 1_000_000_000); // Convert SOL to lamports if needed
    
    // Create transfer transaction
    const transaction = new Transaction().add(
    //SystemProgram.transfer is the standard Solana program for sending SOL. 
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: recipientPubkey,
        lamports,
      })
    );

    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    // recentBlockhash: required by Solana to prevent replay attacks and ensure transaction validity
    transaction.recentBlockhash = blockhash;
    // feePayer: OUR (solmail's) wallet pays the network transaction fee
    transaction.feePayer = wallet.publicKey;

    // Sign and send transaction
    const signedTx = await wallet.signTransaction(transaction);
    // sendRawTransaction → submits the signed transaction to Solana
    const signature = await connection.sendRawTransaction(signedTx.serialize(), {
      skipPreflight: false,
      maxRetries: 3,
    });

    // Waits until the transaction is confirmed on-chain.
    await connection.confirmTransaction(
      {
        signature,
        blockhash,
        lastValidBlockHeight,
      },
      'confirmed'
    );

    //unique identifier for the transaction
    return signature;
  } catch (error) {
    console.error('[x402] Payment transaction failed:', error);
    throw new Error(`x402 payment failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Create x402-wrapped fetch function that handles payment automatically.
 * fetch is a standard web API for making HTTP requests
 */
export function createX402Fetch(
  options: X402ClientOptions
): typeof fetch {
  const { wallet, connection, network = 'mainnet-beta' } = options;

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    // Make initial HTTP request
    let response = await fetch(input, init);

    // Check for 402 Payment Required
    if (response.status === 402) {
      console.log('[x402] Payment required, processing payment...');

      // Parse payment information from headers
      const paymentInfo = parseX402PaymentResponse(response.headers);
      
      if (!paymentInfo) {
        throw new Error('x402 payment required but payment info not found in response headers');
      }

      // Process payment
      try {
        const paymentSignature = await createX402Payment(connection, wallet, paymentInfo);
        console.log('[x402] Payment successful:', paymentSignature);

        // Retry request with payment proof in headers
        const retryHeaders = new Headers(init?.headers);
        retryHeaders.set('x-payment-signature', paymentSignature);
        retryHeaders.set('x-payment-network', network);

        // Retry the request with payment proof
        response = await fetch(input, {
          ...init,
          headers: retryHeaders,
        });

        // If still 402, payment might have failed
        if (response.status === 402) {
          const errorText = await response.text().catch(() => 'Unknown error');
          throw new Error(`x402 payment processed but request still requires payment: ${errorText}`);
        }
      } catch (paymentError) {
        console.error('[x402] Payment processing failed:', paymentError);
        // Return the original 402 response if payment fails, so caller can handle it
        if (response.status === 402) {
          return response;
        }
        throw paymentError;
      }
    }

    return response;
  };
}

/**
 * Initialize x402 client with agent wallet.
 */
export function initializeX402Client(
  wallet: KeypairWallet,
  connection: Connection,
  network?: string
): typeof fetch {
  return createX402Fetch({
    wallet,
    connection,
    network: network || env.X402_NETWORK || 'mainnet-beta',
  });
}

