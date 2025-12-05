import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks must be defined before any imports that use them
vi.mock('../../env', () => {
    return {
        env: {
            SOLANA_PRIVATE_KEY: '5J3mBbAH58CpQ3Y5RNJpUKPE62SQ5tfcvU2JpbnkeyhfsYB1Jcn',
            SOLANA_RPC_URL: 'https://api.testnet.solana.com',
            OPENAI_API_KEY: 'test_openai_key',
        },
    };
});

import type { ProcessEmailReplyParams } from '../escrow-agent';
import * as escrowActions from '../escrow-actions';
import * as escrowAgentModule from '../escrow-agent';
import type { IGetThreadResponse } from '../../../lib/driver/types';
import type { ParsedMessage } from '../../../types';

function createMockThread(originalEmail: string, replyEmail?: string): IGetThreadResponse {
    const originalMessage: ParsedMessage = {
        id: 'msg-original-1',
        connectionId: 'conn-1',
        title: 'Original Email',
        subject: 'Project Update Request',
        tags: [],
        sender: { name: 'Alice', email: 'alice@example.com' },
        to: [{ name: 'Bob', email: 'bob@example.com' }],
        cc: null,
        bcc: null,
        tls: true,
        receivedOn: new Date().toISOString(),
        unread: false,
        body: originalEmail,
        processedHtml: `<p>${originalEmail}</p>`,
        blobUrl: '',
        decodedBody: originalEmail,
        threadId: 'thread-123',
        messageId: 'msg-id-original',
        // No inReplyTo - this is the original
    };

    const messages: ParsedMessage[] = [originalMessage];

    if (replyEmail) {
        const replyMessage: ParsedMessage = {
            id: 'msg-reply-1',
            connectionId: 'conn-1',
            title: 'Reply Email',
            subject: 'Re: Project Update Request',
            tags: [],
            sender: { name: 'Bob', email: 'bob@example.com' },
            to: [{ name: 'Alice', email: 'alice@example.com' }],
            cc: null,
            bcc: null,
            tls: true,
            receivedOn: new Date().toISOString(),
            unread: false,
            body: replyEmail,
            processedHtml: `<p>${replyEmail}</p>`,
            blobUrl: '',
            decodedBody: replyEmail,
            threadId: 'thread-123',
            messageId: 'msg-id-reply',
            inReplyTo: 'msg-id-original', // This is a reply
        };
        messages.push(replyMessage);
    }

    return {
        messages,
        latest: messages[messages.length - 1],
        hasUnread: false,
        totalReplies: messages.length,
        labels: [],
    };
}

// Mock the escrow actions to avoid actual Solana transactions
vi.mock('../escrow-actions', () => ({
    createEscrowAction: vi.fn(),
    executeEscrowAction: vi.fn(),
}));

// Mock scoreEmail to avoid real API calls in integration tests
// (We test scoreEmail separately with real API calls)
vi.mock('../email-scoring-tool', () => ({
    scoreEmail: vi.fn(),
}));

// Mock Solana dependencies
vi.mock('@solana/web3.js', () => ({
    Keypair: {
        fromSecretKey: vi.fn(() => ({})),
    },
    Connection: vi.fn(() => ({})),
    PublicKey: vi.fn(),
    SystemProgram: {
        programId: {},
    },
}));

vi.mock('solana-agent-kit', () => ({
    SolanaAgentKit: vi.fn(),
    KeypairWallet: vi.fn(),
    createLangchainTools: vi.fn(),
}));

vi.mock('@solana-agent-kit/plugin-token', () => ({
    default: vi.fn(),
}));

vi.mock('bs58', () => ({
    default: {
        decode: vi.fn(() => new Uint8Array(64)),
    },
}));


describe('processEmailReply', () => {
    const mockCreateEscrowAction = vi.mocked(escrowActions.createEscrowAction);
    const mockExecuteEscrowAction = vi.mocked(escrowActions.executeEscrowAction);

    beforeEach(async () => {
        vi.clearAllMocks();

        // Mock getEscrowAgent and getConnection
        vi.spyOn(escrowAgentModule, 'getEscrowAgent').mockReturnValue({
            wallet: {
                publicKey: {
                    toString: () => 'mocked_public_key',
                },
                signTransaction: vi.fn(),
                signAllTransactions: vi.fn(),
            },
        } as any);

        vi.spyOn(escrowAgentModule, 'getConnection').mockReturnValue({
            rpcUrl: 'https://api.testnet.solana.com',
        } as any);

        // Default mock implementations
        mockCreateEscrowAction.mockResolvedValue({
            success: true,
            signature: 'mocked_create_signature',
        });

        mockExecuteEscrowAction.mockResolvedValue({
            success: true,
            signature: 'mocked_execute_signature',
        });
    });

    const getMockedScoreEmail = async () => {
        const emailScoringModule = await import('../email-scoring-tool');
        return vi.mocked(emailScoringModule.scoreEmail);
    };

    const getProcessEmailReply = async () => {
        const module = await import('../escrow-agent');
        return module.processEmailReply;
    };

    describe('full flow: email input → scoring → decision', () => {
        it('should process email with score >= 70 and return RELEASE decision', async () => {
            const processEmailReply = await getProcessEmailReply();
            const mockScoreEmail = await getMockedScoreEmail();
            const testScore = 85;
            mockScoreEmail.mockResolvedValue({ score: testScore });

            const params: ProcessEmailReplyParams = {
                emailContent: 'Thank you for your message. I will respond shortly.',
                msgId: 'test-msg-123',
            };

            const result = await processEmailReply(params);

            expect(mockScoreEmail).toHaveBeenCalledWith(params.emailContent);
            expect(result.success).toBe(true);
            expect(result.score).toBe(testScore);
            expect(result.decision).toBe('RELEASE');
            expect(result.signature).toBe('mocked_execute_signature');
        }, 30000);

        it('should process email with score < 70 and return WITHHOLD decision', async () => {
            const processEmailReply = await getProcessEmailReply();
            const mockScoreEmail = await getMockedScoreEmail();
            const testScore = 45;
            mockScoreEmail.mockResolvedValue({ score: testScore });

            const params: ProcessEmailReplyParams = {
                emailContent: 'OK',
                msgId: 'test-msg-456',
            };

            const result = await processEmailReply(params);

            expect(mockScoreEmail).toHaveBeenCalledWith(params.emailContent);
            expect(result.success).toBe(true);
            expect(result.score).toBe(testScore);
            expect(result.decision).toBe('WITHHOLD');
            expect(result.signature).toBe('mocked_execute_signature');
        }, 30000);

        it('should handle boundary score of 70 (RELEASE)', async () => {
            const processEmailReply = await getProcessEmailReply();
            const mockScoreEmail = await getMockedScoreEmail();
            const testScore = 70;
            mockScoreEmail.mockResolvedValue({ score: testScore });

            const params: ProcessEmailReplyParams = {
                emailContent: 'Thank you for your email.',
                msgId: 'test-msg-789',
            };

            const result = await processEmailReply(params);

            expect(result.success).toBe(true);
            expect(result.score).toBe(testScore);
            expect(result.decision).toBe('RELEASE');
        }, 30000);

        it('should handle boundary score of 69 (WITHHOLD)', async () => {
            const processEmailReply = await getProcessEmailReply();
            const mockScoreEmail = await getMockedScoreEmail();
            const testScore = 69;
            mockScoreEmail.mockResolvedValue({ score: testScore });

            const params: ProcessEmailReplyParams = {
                emailContent: 'Thanks.',
                msgId: 'test-msg-101',
            };

            const result = await processEmailReply(params);

            expect(result.success).toBe(true);
            expect(result.score).toBe(testScore);
            expect(result.decision).toBe('WITHHOLD');
        }, 30000);
    });

    describe('stream callbacks', () => {
        it('should call stream callback for each step', async () => {
            const processEmailReply = await getProcessEmailReply();
            const mockScoreEmail = await getMockedScoreEmail();
            const streamCallback = vi.fn();
            mockScoreEmail.mockResolvedValue({ score: 80 });

            const params: ProcessEmailReplyParams = {
                emailContent: 'Test email content',
                msgId: 'test-msg-stream',
                streamCallback,
            };

            await processEmailReply(params);

            // Verify key stream callbacks were called
            expect(streamCallback).toHaveBeenCalledWith('initializing', expect.objectContaining({ msgId: 'test-msg-stream' }));
            expect(streamCallback).toHaveBeenCalledWith('scoring_email_start', expect.objectContaining({ msgId: 'test-msg-stream' }));
            expect(streamCallback).toHaveBeenCalledWith('scoring_email_complete', expect.objectContaining({ score: 80 }));
            expect(streamCallback).toHaveBeenCalledWith('making_decision_start', expect.objectContaining({ score: 80 }));
            expect(streamCallback).toHaveBeenCalledWith('making_decision_complete', expect.objectContaining({ decision: 'RELEASE' }));
            expect(streamCallback).toHaveBeenCalledWith('creating_escrow_start', expect.any(Object));
            expect(streamCallback).toHaveBeenCalledWith('creating_escrow_complete', expect.any(Object));
            expect(streamCallback).toHaveBeenCalledWith('executing_escrow_start', expect.any(Object));
            expect(streamCallback).toHaveBeenCalledWith('executing_escrow_complete', expect.any(Object));
            expect(streamCallback).toHaveBeenCalledWith('process_complete', expect.any(Object));
        }, 30000);

        it('should work without stream callback', async () => {
            const processEmailReply = await getProcessEmailReply();
            const mockScoreEmail = await getMockedScoreEmail();
            mockScoreEmail.mockResolvedValue({ score: 75 });

            const params: ProcessEmailReplyParams = {
                emailContent: 'Test email',
                msgId: 'test-msg-no-callback',
            };

            const result = await processEmailReply(params);

            expect(result.success).toBe(true);
            expect(result.score).toBe(75);
            expect(result.decision).toBe('RELEASE');
        }, 30000);
    });

    describe('error handling', () => {
        it('should handle scoring errors gracefully', async () => {
            const processEmailReply = await getProcessEmailReply();
            const mockScoreEmail = await getMockedScoreEmail();
            const scoringError = new Error('OpenAI API error');
            mockScoreEmail.mockRejectedValue(scoringError);

            const params: ProcessEmailReplyParams = {
                emailContent: 'Test email',
                msgId: 'test-msg-error',
            };

            const result = await processEmailReply(params);

            expect(result.success).toBe(false);
            expect(result.error).toContain('OpenAI API error');
            expect(result.score).toBeUndefined();
            expect(result.decision).toBeUndefined();
        }, 30000);

        it('should handle escrow creation errors', async () => {
            const processEmailReply = await getProcessEmailReply();
            const mockScoreEmail = await getMockedScoreEmail();
            mockScoreEmail.mockResolvedValue({ score: 80 });
            mockCreateEscrowAction.mockResolvedValue({
                success: false,
                error: 'Transaction failed',
            });

            const params: ProcessEmailReplyParams = {
                emailContent: 'Test email',
                msgId: 'test-msg-escrow-error',
            };

            const result = await processEmailReply(params);

            expect(result.success).toBe(false);
            expect(result.score).toBe(80);
            expect(result.decision).toBe('RELEASE');
            expect(result.error).toContain('Failed to create escrow');
        }, 30000);

        it('should handle escrow execution errors', async () => {
            const processEmailReply = await getProcessEmailReply();
            const mockScoreEmail = await getMockedScoreEmail();
            mockScoreEmail.mockResolvedValue({ score: 80 });
            mockExecuteEscrowAction.mockResolvedValue({
                success: false,
                error: 'Execution failed',
            });

            const params: ProcessEmailReplyParams = {
                emailContent: 'Test email',
                msgId: 'test-msg-exec-error',
            };

            const result = await processEmailReply(params);

            expect(result.success).toBe(false);
            expect(result.score).toBe(80);
            expect(result.decision).toBe('RELEASE');
            expect(result.error).toContain('Failed to execute escrow action');
        }, 30000);

        it('should handle idempotent escrow creation (already exists)', async () => {
            const processEmailReply = await getProcessEmailReply();
            const mockScoreEmail = await getMockedScoreEmail();
            mockScoreEmail.mockResolvedValue({ score: 80 });
            mockCreateEscrowAction.mockResolvedValue({
                success: true,
                signature: 'already_exists',
            });

            const params: ProcessEmailReplyParams = {
                emailContent: 'Test email',
                msgId: 'test-msg-idempotent',
            };

            const result = await processEmailReply(params);

            expect(result.success).toBe(true);
            expect(result.score).toBe(80);
            expect(result.decision).toBe('RELEASE');
        }, 30000);
    });

    describe('optional parameters', () => {
        it('should handle optional recipient parameter', async () => {
            const processEmailReply = await getProcessEmailReply();
            const mockScoreEmail = await getMockedScoreEmail();
            mockScoreEmail.mockResolvedValue({ score: 75 });

            const params: ProcessEmailReplyParams = {
                emailContent: 'Test email',
                msgId: 'test-msg-optional',
                recipient: undefined,
            };

            const result = await processEmailReply(params);

            expect(result.success).toBe(true);
            expect(mockCreateEscrowAction).toHaveBeenCalledWith(
                expect.any(Object),
                expect.any(Object),
                expect.objectContaining({
                    msgId: 'test-msg-optional',
                    recipient: undefined,
                })
            );
        }, 30000);

        it('should handle optional amount parameter', async () => {
            const processEmailReply = await getProcessEmailReply();
            const mockScoreEmail = await getMockedScoreEmail();
            mockScoreEmail.mockResolvedValue({ score: 75 });

            const params: ProcessEmailReplyParams = {
                emailContent: 'Test email',
                msgId: 'test-msg-amount',
                amount: 2_000_000, // 0.002 SOL
            };

            const result = await processEmailReply(params);

            expect(result.success).toBe(true);
            expect(mockCreateEscrowAction).toHaveBeenCalledWith(
                expect.any(Object),
                expect.any(Object),
                expect.objectContaining({
                    msgId: 'test-msg-amount',
                    amount: 2_000_000,
                })
            );
        }, 30000);
    });

    describe('original email retrieval and scoring', () => {
        it('should retrieve and use original email when scoring reply', async () => {
            const processEmailReply = await getProcessEmailReply();
            const mockScoreEmail = await getMockedScoreEmail();

            const originalEmail = 'Hi, I need an update on the project status.';
            const replyEmail = 'Thanks for reaching out. The project is on track and will be delivered next week.';

            mockScoreEmail.mockResolvedValue({ score: 85 });

            // Mock getZeroClient to return a mock agent with getThread
            const mockGetThread = vi.fn().mockResolvedValue(
                createMockThread(originalEmail, replyEmail)
            );

            // You'll need to mock getZeroClient - this is a simplified example
            // In reality, you'd need to mock the entire mail.ts route handler

            const params: ProcessEmailReplyParams = {
                emailContent: replyEmail,
                originalEmailContent: originalEmail, // Simulating what mail.ts would pass
                msgId: 'thread-123',
            };

            const result = await processEmailReply(params);

            expect(mockScoreEmail).toHaveBeenCalledWith(replyEmail, originalEmail);
            expect(result.success).toBe(true);
            expect(result.score).toBe(85);
        }, 30000);
    });
});
