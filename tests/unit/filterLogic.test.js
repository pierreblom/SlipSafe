import { describe, it, expect } from 'vitest';
import * as Logic from '@/logic.js';
import { mockSlips } from '../fixtures.js';

describe('Smart Filter Logic', () => {

    describe('This Month Filter', () => {
        it('should return only slips from the current month', () => {
            // Mock "now" to February 2026
            const mockDate = new Date('2026-02-15');
            const result = Logic.applyThisMonthFilter(mockSlips, mockDate);

            // Expected: Woolworths (Feb 10), Steers (Feb 05), Boundary Store (Feb 12)
            // Excluded: Shell (Jan 15), Makro (Dec 20)
            expect(result.length).toBe(3);
            expect(result.find(s => s.merchant === 'Woolworths')).toBeDefined();
            expect(result.find(s => s.merchant === 'Shell Garage')).toBeUndefined();
        });

        it('should return empty array when no slips match current month', () => {
            const mockDate = new Date('2025-01-01'); // No slips in Jan 2025
            const result = Logic.applyThisMonthFilter(mockSlips, mockDate);
            expect(result).toEqual([]);
        });
    });

    describe('High Value Filter', () => {
        it('should return slips with total greater than threshold (default 500)', () => {
            const result = Logic.applyHighValueFilter(mockSlips);
            // Expected: Shell (750), Makro (2500)
            // Excluded: Woolworths (345.90), Steers (89.50), Boundary Store (500 boundary)
            expect(result.length).toBe(2);
            expect(result.find(s => s.merchant === 'Shell Garage')).toBeDefined();
            expect(result.find(s => s.merchant === 'Boundary Store')).toBeUndefined();
        });

        it('should handle custom threshold', () => {
            const result = Logic.applyHighValueFilter(mockSlips, 1000);
            // Expected: Makro (2500)
            expect(result.length).toBe(1);
            expect(result[0].merchant).toBe('Makro');
        });
    });

    describe('Tax Deductible Filter', () => {
        it('should return only slips where is_tax_deductible is true', () => {
            const result = Logic.applyTaxDeductibleFilter(mockSlips);
            // Expected: Woolworths, Shell, Makro, Boundary Store
            // Excluded: Steers (false)
            expect(result.length).toBe(4);
            expect(result.find(s => s.merchant === 'Steers')).toBeUndefined();
        });
    });

    describe('Date Range Filter', () => {
        it('should return slips within inclusive date range', () => {
            const start = '2026-01-01';
            const end = '2026-01-31';
            const result = Logic.applyDateRangeFilter(mockSlips, start, end);

            // Expected: Shell (Jan 15)
            // Excluded: Others
            expect(result.length).toBe(1);
            expect(result[0].merchant).toBe('Shell Garage');
        });

        it('should include boundary dates', () => {
            const start = '2026-02-10'; // Exactly matches Woolworths
            const end = '2026-02-10';
            const result = Logic.applyDateRangeFilter(mockSlips, start, end);
            expect(result.length).toBe(1);
            expect(result[0].merchant).toBe('Woolworths');
        });
    });

    describe('Text Search', () => {
        it('should match by merchant name (case-insensitive)', () => {
            const result = Logic.applyTextSearch(mockSlips, 'woolworths');
            expect(result.length).toBe(1);
            expect(result[0].merchant).toBe('Woolworths');
        });

        it('should match "over R100" to slips above R100', () => {
            const result = Logic.applyTextSearch(mockSlips, 'over R100');
            // Expected: Woolworths (345), Shell (750), Makro (2500), Boundary (500)
            // Excluded: Steers (89.50)
            expect(result.length).toBe(4);
            expect(result.find(s => s.merchant === 'Steers')).toBeUndefined();
        });

        it('should match "under 100" slips', () => {
            const result = Logic.applyTextSearch(mockSlips, 'under 100');
            expect(result.length).toBe(1);
            expect(result[0].merchant).toBe('Steers');
        });
    });

    describe('Sort Slips', () => {
        it('should sort by amount descending', () => {
            const result = Logic.sortSlips(mockSlips, 'amount');
            expect(result[0].merchant).toBe('Makro'); // 2500
            expect(result[result.length - 1].merchant).toBe('Steers'); // 89.50
        });

        it('should sort by date descending (newest first)', () => {
            const result = Logic.sortSlips(mockSlips, 'date');
            // Mock slips have dates: Feb 10, Feb 5, Jan 15, Dec 20, Feb 12
            // Expected order: Feb 12, Feb 10, Feb 5, Jan 15, Dec 20
            expect(result[0].date).toBe('2026-02-12'); // Boundary Store
            expect(result[result.length - 1].date).toBe('2025-12-20'); // Makro
        });
    });
});
