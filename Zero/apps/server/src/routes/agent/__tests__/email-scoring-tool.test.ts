import { describe, it, expect, beforeAll } from 'vitest';
import { scoreEmail } from '../email-scoring-tool';

// Check if OpenAI API key is available
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

describe('scoreEmail', () => {
    beforeAll(() => {
        if (!OPENAI_API_KEY) {
            throw new Error(
                'OPENAI_API_KEY environment variable is required for these tests. ' +
                'Set it in your .env file or test environment.'
            );
        }
    });

    describe('boundary cases - scores near threshold (65-75)', () => {
        it('should score an adequate email reply (expecting ~65-69)', async () => {
            const emailContent = `
        Hi,
        
        Thanks for your message. I'll look into it and get back to you soon.
        
        Best regards
      `;

            const result = await scoreEmail(emailContent);
            expect(result.score).toBeGreaterThanOrEqual(0);
            expect(result.score).toBeLessThanOrEqual(100);
            // Should be in the adequate range, likely below threshold
            expect(result.score).toBeGreaterThanOrEqual(50);
            expect(result.score).toBeLessThan(75);
        }, 30000);

        it('should score a good email reply (expecting ~70-75)', async () => {
            const emailContent = `
        Hi there,
        
        Thank you for reaching out. I've reviewed your request and here's my response:
        
        I understand your concern about the project timeline. Based on our current resources, 
        we can deliver the first phase by next week. I'll send you a detailed plan by tomorrow.
        
        Please let me know if you have any questions.
        
        Best regards,
        John
      `;

            const result = await scoreEmail(emailContent);
            expect(result.score).toBeGreaterThanOrEqual(0);
            expect(result.score).toBeLessThanOrEqual(100);
            // Should be in the good range, potentially at or above threshold
            expect(result.score).toBeGreaterThanOrEqual(60);
        }, 30000);
    });

    describe('edge cases - empty and minimal content', () => {
        it('should handle very short email (<10 chars)', async () => {
            const emailContent = 'OK';

            const result = await scoreEmail(emailContent);
            expect(result.score).toBeGreaterThanOrEqual(0);
            expect(result.score).toBeLessThanOrEqual(100);
            // Very short emails should score low
            expect(result.score).toBeLessThan(50);
        }, 30000);

        it('should handle HTML-only email (no text content)', async () => {
            const emailContent = '<div><img src="image.jpg" /></div>';

            const result = await scoreEmail(emailContent);
            expect(result.score).toBeGreaterThanOrEqual(0);
            expect(result.score).toBeLessThanOrEqual(100);
            // HTML-only with no text should score very low or error (returns 0)
            expect(result.score).toBeLessThan(30);
        }, 30000);

        it('should handle email with only whitespace', async () => {
            const emailContent = '   \n\n\t  ';

            // This should either error or return 0
            const result = await scoreEmail(emailContent);
            expect(result.score).toBeGreaterThanOrEqual(0);
            expect(result.score).toBeLessThanOrEqual(100);
            // Empty/whitespace should score 0 (error fallback)
            expect(result.score).toBe(0);
        }, 30000);
    });

    describe('quality extremes', () => {
        it('should score high-quality professional email (expecting 90-100)', async () => {
            const emailContent = `
        Dear Team,
        
        I wanted to follow up on our discussion regarding the Q4 project deliverables. 
        After careful analysis of the requirements and stakeholder feedback, I've prepared 
        a comprehensive implementation plan.
        
        Key highlights:
        1. Phase 1 will focus on core functionality (Week 1-2)
        2. Phase 2 will add advanced features (Week 3-4)
        3. Testing and deployment in Week 5
        
        I've attached the detailed project plan document for your review. Please provide 
        feedback by Friday so we can proceed with implementation.
        
        I'm available for a call this week if you'd like to discuss any aspects in detail.
        
        Best regards,
        Sarah Johnson
        Project Manager
      `;

            const result = await scoreEmail(emailContent);
            expect(result.score).toBeGreaterThanOrEqual(0);
            expect(result.score).toBeLessThanOrEqual(100);
            // High-quality professional email should score high
            expect(result.score).toBeGreaterThanOrEqual(70);
        }, 30000);

        it('should score spam/gibberish email (expecting 0-29)', async () => {
            const emailContent = 'asdfghjkl qwertyuiop zxcvbnm 123456789 !@#$%^&*()';

            const result = await scoreEmail(emailContent);
            expect(result.score).toBeGreaterThanOrEqual(0);
            expect(result.score).toBeLessThanOrEqual(100);
            // Gibberish should score very low
            expect(result.score).toBeLessThan(30);
        }, 30000);
    });

    describe('special characters and formatting', () => {
        it('should handle email with unicode and emojis', async () => {
            const emailContent = 'Hello! 👋 Thanks for your message. I\'ll respond soon. 你好';

            const result = await scoreEmail(emailContent);
            expect(result.score).toBeGreaterThanOrEqual(0);
            expect(result.score).toBeLessThanOrEqual(100);
        }, 30000);

        it('should handle email with special formatting', async () => {
            const emailContent = `
        *Important* Update:
        
        - Item 1: Status update
        - Item 2: Next steps
        - Item 3: Action required
        
        Please review and confirm.
      `;

            const result = await scoreEmail(emailContent);
            expect(result.score).toBeGreaterThanOrEqual(0);
            expect(result.score).toBeLessThanOrEqual(100);
        }, 30000);
    });

    describe('very long email (>5000 chars)', () => {
        it('should handle very long email content', async () => {
            const longContent = 'This is a test email. '.repeat(250); // ~5000 chars

            const result = await scoreEmail(longContent);
            expect(result.score).toBeGreaterThanOrEqual(0);
            expect(result.score).toBeLessThanOrEqual(100);
        }, 30000);
    });

    describe('return value validation', () => {
        it('should return valid EmailScoringResult with score property', async () => {
            const emailContent = 'Thank you for your email. I will respond shortly.';

            const result = await scoreEmail(emailContent);

            expect(result).toHaveProperty('score');
            expect(typeof result.score).toBe('number');
            expect(result.score).toBeGreaterThanOrEqual(0);
            expect(result.score).toBeLessThanOrEqual(100);
        }, 30000);
    });
});

describe('scoring with original email context', () => {
    it('should score a reply that addresses the original email well', async () => {
        const originalEmail = `
            Hi,
            
            I'm reaching out to discuss the project timeline. We need to deliver 
            the first phase by next week. Can you provide an update on the current 
            status and any blockers you're facing?
            
            Best regards,
            Alice
        `;

        const replyEmail = `
            Hi Alice,
            
            Thank you for reaching out. I've reviewed the project requirements and 
            here's the current status:
            
            - Phase 1 is 80% complete
            - We're on track to deliver by next week
            - No major blockers at the moment
            
            I'll send you a detailed progress report by tomorrow.
            
            Best regards,
            Bob
        `;

        const result = await scoreEmail(replyEmail, originalEmail);
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
        // Should score higher when it addresses the original email well
        expect(result.score).toBeGreaterThanOrEqual(70);
    }, 30000);

    it('should score a reply that ignores the original email poorly', async () => {
        const originalEmail = `
            Hi,
            
            I need urgent help with the database migration. The production system 
            is down and we need to rollback immediately.
            
            Please respond ASAP.
        `;

        const replyEmail = `
            Thanks for your message. I'll get back to you soon.
        `;

        const result = await scoreEmail(replyEmail, originalEmail);
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
        // Should score lower when it doesn't address urgent original email
        expect(result.score).toBeLessThan(70);
    }, 30000);

    it('should work without original email (backward compatibility)', async () => {
        const replyEmail = 'Thank you for your email. I will respond shortly.';

        const result = await scoreEmail(replyEmail);

        expect(result).toHaveProperty('score');
        expect(typeof result.score).toBe('number');
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
    }, 30000);
});

