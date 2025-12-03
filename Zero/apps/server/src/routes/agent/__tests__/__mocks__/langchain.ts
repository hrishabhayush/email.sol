import { vi } from 'vitest';

/**
 * Mock LangChain ChatOpenAI response
 */
export function createMockChatOpenAIResponse(score: number = 85) {
    return {
        content: JSON.stringify({ score }),
        response_metadata: {},
    };
}

/**
 * Mock ChatOpenAI class
 */
export function createMockChatOpenAI() {
    return {
        invoke: vi.fn().mockResolvedValue(createMockChatOpenAIResponse(85)),
    };
}

