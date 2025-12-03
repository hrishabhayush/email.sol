import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmailScoringTool, scoreEmail } from '../email-scoring-tool';

/*
Tests for EmailScoringTool:
- Constructor with/without x402 fetch
- Email scoring with HTML stripping
- Empty content handling
- JSON parsing errors
- Markdown code block extraction
- x402 error re-throwing
- Non-x402 error handling

Tests for scoreEmail:
- Wrapper function behavior
- x402 fetch passing
*/

// Mock LangChain - avoid hoisting issues by not calling createMockChatOpenAI at top level
vi.mock('@langchain/openai', () => ({
    ChatOpenAI: vi.fn().mockImplementation(() => ({
        invoke: vi.fn().mockResolvedValue({
            content: JSON.stringify({ score: 85 }),
            response_metadata: {},
        }),
    })),
}));

// Mock environment
vi.mock('../../env', () => ({
    env: {
        OPENAI_MINI_MODEL: 'gpt-4o-mini',
        OPENAI_API_KEY: 'test-key',
        X402_API_URL: 'https://x402-proxy.example.com',
    },
}));

describe('EmailScoringTool', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('constructor', () => {
        it('should create tool without x402 fetch', () => {
            const tool = new EmailScoringTool();
            expect(tool).toBeDefined();
        });

        it('should create tool with x402 fetch', () => {
            const mockFetch = vi.fn();
            const tool = new EmailScoringTool({ x402Fetch: mockFetch });
            expect(tool).toBeDefined();
        });
    });

    describe('_call', () => {
        it('should score email successfully', async () => {
            const tool = new EmailScoringTool();
            const mockLLM = {
                invoke: vi.fn().mockResolvedValue({
                    content: JSON.stringify({ score: 85 }),
                }),
            };
            (tool as any).llm = mockLLM;

            const result = await tool._call({
                emailContent: 'This is a test email with good content.',
            });

            const parsed = JSON.parse(result);
            expect(parsed).toHaveProperty('score');
            expect(parsed.score).toBeGreaterThanOrEqual(0);
            expect(parsed.score).toBeLessThanOrEqual(100);
            expect(mockLLM.invoke).toHaveBeenCalled();
        });

        it('should handle HTML content and strip it', async () => {
            const tool = new EmailScoringTool();
            const mockLLM = {
                invoke: vi.fn().mockResolvedValue({
                    content: JSON.stringify({ score: 85 }),
                }),
            };
            (tool as any).llm = mockLLM;

            await tool._call({
                emailContent: '<p>This is <b>HTML</b> content</p>',
            });

            // Verify that HTML was stripped before sending to LLM
            const callArgs = (mockLLM.invoke as any).mock.calls[0][0];
            expect(callArgs).not.toContain('<p>');
            expect(callArgs).not.toContain('<b>');
        });

        it('should return score 0 for empty email content', async () => {
            const tool = new EmailScoringTool();
            const mockLLM = {
                invoke: vi.fn().mockResolvedValue({
                    content: JSON.stringify({ score: 85 }),
                }),
            };
            (tool as any).llm = mockLLM;

            const result = await tool._call({
                emailContent: '   ',
            });

            const parsed = JSON.parse(result);
            expect(parsed.score).toBe(0);
        });

        it('should handle JSON parsing errors gracefully', async () => {
            const tool = new EmailScoringTool();
            const mockLLM = {
                invoke: vi.fn().mockResolvedValue({
                    content: 'Invalid response without JSON',
                }),
            };
            (tool as any).llm = mockLLM;

            const result = await tool._call({
                emailContent: 'Test email',
            });

            // Should return score 0 on parsing error
            const parsed = JSON.parse(result);
            expect(parsed.score).toBe(0);
        });

        it('should extract score from markdown code blocks', async () => {
            const tool = new EmailScoringTool();
            const mockLLM = {
                invoke: vi.fn().mockResolvedValue({
                    content: '```json\n{"score": 75}\n```',
                }),
            };
            (tool as any).llm = mockLLM;

            const result = await tool._call({
                emailContent: 'Test email',
            });

            const parsed = JSON.parse(result);
            expect(parsed.score).toBe(75);
        });

        it('should re-throw x402 payment errors', async () => {
            const tool = new EmailScoringTool();
            const mockLLM = {
                invoke: vi.fn().mockRejectedValue(new Error('x402 payment required')),
            };
            (tool as any).llm = mockLLM;

            await expect(
                tool._call({
                    emailContent: 'Test email',
                })
            ).rejects.toThrow('x402 payment error');
        });

        it('should handle non-x402 errors by returning score 0', async () => {
            const tool = new EmailScoringTool();
            const mockLLM = {
                invoke: vi.fn().mockRejectedValue(new Error('Network error')),
            };
            (tool as any).llm = mockLLM;

            const result = await tool._call({
                emailContent: 'Test email',
            });

            const parsed = JSON.parse(result);
            expect(parsed.score).toBe(0);
        });
    });
});

describe('scoreEmail', () => {
    it('should score email using tool', async () => {
        // Mock the _call method
        const mockCall = vi.fn().mockResolvedValue(JSON.stringify({ score: 85 }));
        vi.spyOn(EmailScoringTool.prototype, '_call' as any).mockImplementation(mockCall);

        const result = await scoreEmail('Test email content');

        expect(result).toHaveProperty('score');
        expect(result.score).toBe(85);
        expect(mockCall).toHaveBeenCalledWith({ emailContent: 'Test email content' });
    });

    it('should pass x402 fetch to tool', async () => {
        const mockFetch = vi.fn();
        const mockCall = vi.fn().mockResolvedValue(JSON.stringify({ score: 85 }));
        vi.spyOn(EmailScoringTool.prototype, '_call' as any).mockImplementation(mockCall);

        await scoreEmail('Test email', mockFetch);

        // Verify tool was created and called
        expect(mockCall).toHaveBeenCalled();
    });
});

