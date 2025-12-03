import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Connection, PublicKey } from '@solana/web3.js';
import { processEmailReply, type ProcessEmailReplyParams } from '../escrow-agent';
import { createMockConnection, createMockKeypairWallet } from './__mocks__/solana';
import { createMockX402Fetch } from './__mocks__/x402';

/*
Tests for processEmailReply:
- Success scenario with x402
- x402 client initialization
- API fee calculation
- Stream callback handling
- Fallback to direct API
- x402 payment failure handling
- Escrow creation errors
- Escrow execution errors
- General errors handling
- Default amount handling
*/

// Mock dependencies
vi.mock('../email-scoring-tool', () => ({
  scoreEmail: vi.fn().mockResolvedValue({ score: 85 }),
  EmailScoringTool: vi.fn(),
}));

vi.mock('../escrow-decision', () => ({
  decide: vi.fn().mockReturnValue('RELEASE'),
}));

vi.mock('../escrow-actions', () => ({
  createEscrowAction: vi.fn().mockResolvedValue({
    success: true,
    signature: 'mock-escrow-signature',
  }),
  executeEscrowAction: vi.fn().mockResolvedValue({
    success: true,
    signature: 'mock-execute-signature',
  }),
  calculateApiFee: vi.fn().mockReturnValue(20_000),
}));

vi.mock('../x402-client', () => ({
  initializeX402Client: vi.fn().mockReturnValue(createMockX402Fetch()),
}));

// Mock env module to avoid cloudflare:workers import
vi.mock('../../env', async () => {
  return {
    env: {
      SOLANA_PRIVATE_KEY: 'test-private-key',
      SOLANA_RPC_URL: 'https://api.testnet.solana.com',
      X402_NETWORK: 'testnet',
      X402_FEE_PERCENTAGE: '2',
      OPENAI_API_KEY: 'test-key',
    },
  };
});

vi.mock('solana-agent-kit', () => ({
  SolanaAgentKit: vi.fn().mockImplementation(() => ({
    wallet: createMockKeypairWallet(),
    use: vi.fn().mockReturnThis(),
  })),
  KeypairWallet: vi.fn(),
  createLangchainTools: vi.fn().mockReturnValue([]),
}));

describe('escrow-agent', () => {
  let mockParams: ProcessEmailReplyParams;
  const mockStreamCallback = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockParams = {
      emailContent: 'This is a test email reply with good content.',
      msgId: 'test-msg-123',
      streamCallback: mockStreamCallback,
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('processEmailReply', () => {
    it('should process email reply successfully with x402', async () => {
      const result = await processEmailReply(mockParams);

      expect(result.success).toBe(true);
      expect(result.score).toBe(85);
      expect(result.decision).toBe('RELEASE');
      expect(result.signature).toBe('mock-execute-signature');
    });

    it('should initialize x402 client', async () => {
      const { initializeX402Client } = await import('../x402-client');

      await processEmailReply(mockParams);

      expect(initializeX402Client).toHaveBeenCalled();
    });

    it('should calculate API fee and deduct from escrow', async () => {
      const { createEscrowAction } = await import('../escrow-actions');

      await processEmailReply({
        ...mockParams,
        amount: 1_000_000, // 0.001 SOL
      });

      expect(createEscrowAction).toHaveBeenCalled();
      const callArgs = (createEscrowAction as any).mock.calls[0];
      const escrowParams = callArgs[2];

      expect(escrowParams.apiFeeAmount).toBeDefined();
      expect(escrowParams.amount).toBe(1_000_000);
    });

    it('should call streamCallback for each step', async () => {
      await processEmailReply(mockParams);

      expect(mockStreamCallback).toHaveBeenCalledWith('initializing', expect.any(Object));
      expect(mockStreamCallback).toHaveBeenCalledWith('scoring_email_start', expect.any(Object));
      expect(mockStreamCallback).toHaveBeenCalledWith('scoring_email_complete', expect.any(Object));
      expect(mockStreamCallback).toHaveBeenCalledWith('making_decision_start', expect.any(Object));
      expect(mockStreamCallback).toHaveBeenCalledWith('creating_escrow_start', expect.any(Object));
      expect(mockStreamCallback).toHaveBeenCalledWith('executing_escrow_start', expect.any(Object));
      expect(mockStreamCallback).toHaveBeenCalledWith('process_complete', expect.any(Object));
    });

    it('should fallback to direct API if x402 initialization fails', async () => {
      const { initializeX402Client } = await import('../x402-client');
      (initializeX402Client as any).mockImplementationOnce(() => {
        throw new Error('x402 init failed');
      });

      const result = await processEmailReply(mockParams);

      expect(result.success).toBe(true);
      expect(mockStreamCallback).toHaveBeenCalledWith(
        'x402_client_fallback',
        expect.objectContaining({ error: expect.any(String) })
      );
    });

    it('should fallback to direct API if x402 payment fails', async () => {
      const { scoreEmail } = await import('../email-scoring-tool');
      (scoreEmail as any)
        .mockRejectedValueOnce(new Error('x402 payment error'))
        .mockResolvedValueOnce({ score: 85 });

      const result = await processEmailReply(mockParams);

      expect(result.success).toBe(true);
      expect(scoreEmail).toHaveBeenCalledTimes(2); // First with x402, second without
      expect(mockStreamCallback).toHaveBeenCalledWith(
        'x402_payment_failed_fallback',
        expect.any(Object)
      );
    });

    it('should handle escrow creation errors', async () => {
      const { createEscrowAction } = await import('../escrow-actions');
      (createEscrowAction as any).mockResolvedValueOnce({
        success: false,
        error: 'Escrow creation failed',
      });

      const result = await processEmailReply(mockParams);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to create escrow');
    });

    it('should handle escrow execution errors', async () => {
      const { executeEscrowAction } = await import('../escrow-actions');
      (executeEscrowAction as any).mockResolvedValueOnce({
        success: false,
        error: 'Execution failed',
      });

      const result = await processEmailReply(mockParams);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to execute escrow action');
    });

    it('should handle general errors gracefully', async () => {
      const { scoreEmail } = await import('../email-scoring-tool');
      (scoreEmail as any).mockRejectedValue(new Error('Unexpected error'));

      const result = await processEmailReply(mockParams);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(mockStreamCallback).toHaveBeenCalledWith(
        'process_error',
        expect.objectContaining({ error: expect.any(String) })
      );
    });

    it('should use default amount if not provided', async () => {
      const { createEscrowAction } = await import('../escrow-actions');

      await processEmailReply({
        ...mockParams,
        amount: undefined,
      });

      expect(createEscrowAction).toHaveBeenCalled();
      const callArgs = (createEscrowAction as any).mock.calls[0];
      const escrowParams = callArgs[2];

      // Should use default 1,000,000 lamports
      expect(escrowParams.amount).toBe(1_000_000);
    });
  });
});

