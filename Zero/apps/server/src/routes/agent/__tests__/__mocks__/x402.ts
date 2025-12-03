import { vi } from 'vitest';
import type { X402PaymentResponse } from '../../x402-client';

/**
 * Create a mock x402 payment response header
 */
export function createMockX402PaymentHeader(paymentInfo: Partial<X402PaymentResponse> = {}): string {
    const defaultPayment: X402PaymentResponse = {
        amount: '0.0001',
        recipient: '11111111111111111111111111111111',
        network: 'mainnet-beta',
        ...paymentInfo,
    };

    return encodeURIComponent(JSON.stringify(defaultPayment));
}

/**
 * Create a mock 402 Payment Required response
 */
export function createMock402Response(paymentInfo?: Partial<X402PaymentResponse>): Response {
    const headers = new Headers();
    headers.set('x-payment-response', createMockX402PaymentHeader(paymentInfo));

    return new Response('Payment Required', {
        status: 402,
        headers,
    });
}

/**
 * Create a mock successful response (after payment)
 */
export function createMockSuccessResponse(body: any = { success: true }): Response {
    return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}

/**
 * Mock fetch function that simulates x402 payment flow
 */
export function createMockX402Fetch(
    options: {
        requiresPayment?: boolean;
        paymentInfo?: Partial<X402PaymentResponse>;
        successResponse?: any;
        shouldFailPayment?: boolean;
    } = {}
): typeof fetch {
    const {
        requiresPayment = false,
        paymentInfo,
        successResponse = { data: 'success' },
        shouldFailPayment = false,
    } = options;

    let paymentAttempted = false;

    return vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
        // First request - return 402 if payment required
        if (requiresPayment && !paymentAttempted) {
            const hasPaymentSignature = init?.headers &&
                (init.headers as Headers).get?.('x-payment-signature');

            if (!hasPaymentSignature) {
                return createMock402Response(paymentInfo);
            }

            paymentAttempted = true;

            // If payment should fail, return 402 again
            if (shouldFailPayment) {
                return createMock402Response(paymentInfo);
            }
        }

        // Return success response
        return createMockSuccessResponse(successResponse);
    });
}

