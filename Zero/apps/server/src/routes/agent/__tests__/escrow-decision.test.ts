import { describe, it, expect } from 'vitest';
import { decide, type EscrowDecision } from '../escrow-decision';

describe('decide', () => {
    it('should return RELEASE for score >= 70', () => {
        expect(decide(70)).toBe('RELEASE');
        expect(decide(71)).toBe('RELEASE');
        expect(decide(100)).toBe('RELEASE');
        expect(decide(85)).toBe('RELEASE');
    });

    it('should return WITHHOLD for score < 70', () => {
        expect(decide(69)).toBe('WITHHOLD');
        expect(decide(0)).toBe('WITHHOLD');
        expect(decide(50)).toBe('WITHHOLD');
        expect(decide(30)).toBe('WITHHOLD');
    });

    it('should handle boundary values correctly', () => {
        // Exact threshold
        expect(decide(70)).toBe('RELEASE');
        // Just below threshold
        expect(decide(69)).toBe('WITHHOLD');
        // Just above threshold
        expect(decide(71)).toBe('RELEASE');
    });

    it('should handle edge cases', () => {
        // Minimum valid score
        expect(decide(0)).toBe('WITHHOLD');
        // Maximum valid score
        expect(decide(100)).toBe('RELEASE');
        // Negative numbers (edge case - should still work)
        expect(decide(-1)).toBe('WITHHOLD');
        // Numbers > 100 (edge case - should still work)
        expect(decide(101)).toBe('RELEASE');
        expect(decide(200)).toBe('RELEASE');
    });

    it('should return correct type', () => {
        const result1 = decide(70);
        const result2 = decide(69);

        expect(result1).toBe('RELEASE');
        expect(result2).toBe('WITHHOLD');

        // Type check
        const validDecisions: EscrowDecision[] = ['RELEASE', 'WITHHOLD'];
        expect(validDecisions).toContain(result1);
        expect(validDecisions).toContain(result2);
    });
});

