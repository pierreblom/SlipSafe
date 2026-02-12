import { describe, it, expect } from 'vitest';
import * as Logic from '@/logic.js';

describe('Onboarding Validation', () => {

    describe('Business Name Validation', () => {
        it('should accept a valid business name', () => {
            expect(Logic.validateBusinessName('Test Corp')).toBe(true);
        });

        it('should accept an empty string (optional field)', () => {
            expect(Logic.validateBusinessName('')).toBe(true);
        });

        it('should reject non-string values', () => {
            expect(Logic.validateBusinessName(123)).toBe(false);
            expect(Logic.validateBusinessName(undefined)).toBe(false);
        });
    });

    describe('Budget Validation', () => {
        it('should accept a positive budget amount', () => {
            expect(Logic.validateBudget('5000')).toBe(true);
            expect(Logic.validateBudget('100.50')).toBe(true);
        });

        it('should allow empty budget (user can skip)', () => {
            expect(Logic.validateBudget('')).toBe(true);
            expect(Logic.validateBudget(null)).toBe(true);
        });

        it('should accept zero budget', () => {
            expect(Logic.validateBudget('0')).toBe(true);
        });

        it('should reject negative budget', () => {
            expect(Logic.validateBudget('-100')).toBe(false);
        });

        it('should reject non-numeric strings', () => {
            expect(Logic.validateBudget('abc')).toBe(false);
        });
    });
});
