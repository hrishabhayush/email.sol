import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Connection } from '@solana/web3.js';
import { KeypairWallet } from 'solana-agent-kit';
import { createX402Fetch, initializeX402Client, type X402PaymentResponse } from '../x402-client';
import { createMockConnection, createMockKeypairWallet } from './__mocks__/solana';
import { createMock402Response } from './__mocks__/x402';

// Mock env to avoid cloudflare:workers import
vi.mock('../../env', async () => {
    return {
        env: {
            X402_NETWORK: 'testnet',
        },
    };
});

/*
Tests for createX402Fetch:
- Pass-through for non-402 responses
- 402 payment handling and retry logic
- Payment header parsing
- Payment failure handling
- Retry with payment signature

Tests for initializeX402Client:
- Initialization with default/custom network
*/

describe('x402-client', () => {
    let mockConnection: Connection;
    let mockWallet: KeypairWallet;
    let originalFetch: typeof fetch;

    beforeEach(() => {
        mockConnection = createMockConnection();
        mockWallet = createMockKeypairWallet();
        originalFetch = global.fetch;
    });

    afterEach(() => {
        global.fetch = originalFetch;
        vi.clearAllMocks();
    });

    describe('createX402Fetch', () => {
        it('should pass through non-402 responses', async () => {
            const mockResponse = new Response(JSON.stringify({ data: 'success' }), { status: 200 });
            global.fetch = vi.fn().mockResolvedValue(mockResponse);

            const x402Fetch = createX402Fetch({
                wallet: mockWallet,
                connection: mockConnection,
                network: 'mainnet-beta',
            });

            const response = await x402Fetch('https://api.example.com/test');

            expect(response.status).toBe(200);
            expect(global.fetch).toHaveBeenCalledTimes(1);
        });

        it('should handle 402 Payment Required and process payment', async () => {
            const paymentInfo: X402PaymentResponse = {
                amount: '0.0001',
                recipient: mockWallet.publicKey.toString(),
                network: 'mainnet-beta',
            };

            // First call returns 402, second call (after payment) returns 200
            let callCount = 0;
            global.fetch = vi.fn().mockImplementation(async (input, init) => {
                callCount++;
                if (callCount === 1) {
                    // First request - return 402
                    return createMock402Response(paymentInfo);
                } else {
                    // Second request (with payment signature) - return success
                    // Check for payment signature in headers
                    const headers = init?.headers;
                    let hasPaymentSignature = false;
                    if (headers instanceof Headers) {
                        hasPaymentSignature = headers.get('x-payment-signature') !== null;
                    } else if (headers && typeof headers === 'object') {
                        hasPaymentSignature = !!(headers as any)['x-payment-signature'] || !!(headers as any)['X-Payment-Signature'];
                    }
                    expect(hasPaymentSignature).toBeTruthy();
                    return new Response(JSON.stringify({ data: 'success' }), { status: 200 });
                }
            });

            const x402Fetch = createX402Fetch({
                wallet: mockWallet,
                connection: mockConnection,
                network: 'mainnet-beta',
            });

            const response = await x402Fetch('https://api.example.com/test');

            expect(response.status).toBe(200);
            expect(global.fetch).toHaveBeenCalledTimes(2);
            expect(mockConnection.getLatestBlockhash).toHaveBeenCalled();
            expect(mockConnection.sendRawTransaction).toHaveBeenCalled();
        });

        it('should throw error if payment info is missing from 402 response', async () => {
            const response402 = new Response('Payment Required', {
                status: 402,
                headers: new Headers(), // No x-payment-response header
            });

            global.fetch = vi.fn().mockResolvedValue(response402);

            const x402Fetch = createX402Fetch({
                wallet: mockWallet,
                connection: mockConnection,
            });

            await expect(x402Fetch('https://api.example.com/test')).rejects.toThrow(
                'x402 payment required but payment info not found'
            );
        });

        it('should handle payment failure gracefully', async () => {
            const paymentInfo: X402PaymentResponse = {
                amount: '0.0001',
                recipient: mockWallet.publicKey.toString(),
                network: 'mainnet-beta',
            };

            // Mock connection to fail on sendRawTransaction
            const failingConnection = createMockConnection();
            (failingConnection.sendRawTransaction as any).mockRejectedValue(
                new Error('Transaction failed')
            );

            global.fetch = vi.fn().mockResolvedValue(createMock402Response(paymentInfo));

            const x402Fetch = createX402Fetch({
                wallet: mockWallet,
                connection: failingConnection,
            });

            // Should return 402 response when payment fails
            const response = await x402Fetch('https://api.example.com/test');
            expect(response.status).toBe(402);
        });

        it('should retry with payment signature in headers', async () => {
            const paymentInfo: X402PaymentResponse = {
                amount: '0.0001',
                recipient: mockWallet.publicKey.toString(),
                network: 'mainnet-beta',
            };

            let retryHeaders: Headers | Record<string, string> | undefined;
            let callCount = 0;
            global.fetch = vi.fn().mockImplementation(async (input, init) => {
                callCount++;
                if (init?.headers) {
                    // Headers can be Headers object or plain object
                    if (init.headers instanceof Headers) {
                        retryHeaders = init.headers;
                    } else {
                        retryHeaders = init.headers as Record<string, string>;
                    }
                }
                // First call returns 402, subsequent calls return 200
                if (callCount === 1) {
                    return createMock402Response(paymentInfo);
                }
                return new Response(JSON.stringify({ data: 'success' }), { status: 200 });
            });

            const x402Fetch = createX402Fetch({
                wallet: mockWallet,
                connection: mockConnection,
                network: 'testnet',
            });

            await x402Fetch('https://api.example.com/test', {
                headers: { 'Content-Type': 'application/json' },
            });

            // Verify fetch was called twice (initial + retry with payment)
            expect(global.fetch).toHaveBeenCalledTimes(2);

            // Check if payment signature was added (either as Headers object or plain object)
            if (retryHeaders instanceof Headers) {
                expect(retryHeaders.get('x-payment-signature')).toBeTruthy();
                expect(retryHeaders.get('x-payment-network')).toBe('testnet');
            } else if (retryHeaders && typeof retryHeaders === 'object') {
                // Plain object case - check for payment signature
                const headersObj = retryHeaders as Record<string, string>;
                const hasPaymentSig = headersObj['x-payment-signature'] ||
                    headersObj['X-Payment-Signature'] ||
                    Object.keys(headersObj).some(k => k.toLowerCase() === 'x-payment-signature');
                expect(hasPaymentSig).toBeTruthy();
            }
        });
    });

    describe('initializeX402Client', () => {
        it('should initialize client with default network', () => {
            const x402Fetch = initializeX402Client(mockWallet, mockConnection);
            expect(x402Fetch).toBeDefined();
            expect(typeof x402Fetch).toBe('function');
        });

        it('should initialize client with custom network', () => {
            const x402Fetch = initializeX402Client(mockWallet, mockConnection, 'devnet');
            expect(x402Fetch).toBeDefined();
        });
    });
});

