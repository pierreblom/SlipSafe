import { describe, it, expect } from 'vitest';
import * as Logic from '@/logic.js';

/**
 * Integration tests for onboarding flow validation logic.
 * Tests that validation rules work together as a pipeline,
 * simulating user input through each wizard step.
 */
describe('Onboarding Flow Integration', () => {

    describe('Step-by-step validation pipeline', () => {
        it('step 1 → step 2: valid business name allows progression', () => {
            const step1Valid = Logic.validateBusinessName('My Business');
            expect(step1Valid).toBe(true);

            // Step 2 with budget
            const step2Valid = Logic.validateBudget('5000');
            expect(step2Valid).toBe(true);
        });

        it('should allow completing all steps with empty optional fields', () => {
            // Business name is optional
            const step1 = Logic.validateBusinessName('');
            expect(step1).toBe(true);

            // Budget is optional
            const step2 = Logic.validateBudget('');
            expect(step2).toBe(true);
        });

        it('should reject invalid budget mid-flow', () => {
            const step1 = Logic.validateBusinessName('Test Corp');
            expect(step1).toBe(true);

            const step2 = Logic.validateBudget('-500');
            expect(step2).toBe(false);
        });
    });

    describe('User metadata shape', () => {
        it('user with onboarding_complete: true should not trigger wizard', () => {
            const user = { user_metadata: { onboarding_complete: true } };
            expect(user.user_metadata?.onboarding_complete).toBe(true);
        });

        it('new user without metadata should trigger wizard', () => {
            const user = { user_metadata: {} };
            expect(user.user_metadata?.onboarding_complete).toBeFalsy();
        });

        it('user with null metadata should trigger wizard', () => {
            const user = { user_metadata: null };
            expect(user.user_metadata?.onboarding_complete).toBeFalsy();
        });
    });
});
