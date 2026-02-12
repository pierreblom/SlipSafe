import { describe, it, expect, beforeEach } from 'vitest';
import * as Logic from '@/logic.js';
import { mockSlips } from '../fixtures.js';

/**
 * Integration tests for smart filter chips.
 * These test the interplay between multiple filters applied together (AND logic),
 * simulating how the app combines chips + category + search in a pipeline.
 */
describe('Smart Filter Chips Integration', () => {

    let slips;

    beforeEach(() => {
        slips = [...mockSlips];
    });

    describe('Combined Filter Pipeline (AND logic)', () => {
        it('thisMonth + highValue returns only high-value current-month slips', () => {
            const mockDate = new Date('2026-02-15');
            let result = Logic.applyThisMonthFilter(slips, mockDate);
            result = Logic.applyHighValueFilter(result);
            // Only slips from Feb 2026 AND > R500: none (Woolworths is 345.90, Steers 89.50, Boundary 500 exact)
            expect(result.length).toBe(0);
        });

        it('thisMonth + taxDeductible returns only deductible slips from this month', () => {
            const mockDate = new Date('2026-02-15');
            let result = Logic.applyThisMonthFilter(slips, mockDate);
            result = Logic.applyTaxDeductibleFilter(result);
            // Feb slips: Woolworths (deductible), Steers (NOT), Boundary (deductible)
            expect(result.length).toBe(2);
            expect(result.map(s => s.merchant).sort()).toEqual(['Boundary Store', 'Woolworths']);
        });

        it('category + dateRange narrows results correctly', () => {
            let result = Logic.applyCategoryFilter(slips, 'General Business');
            result = Logic.applyDateRangeFilter(result, '2026-02-01', '2026-02-28');
            // General Business in Feb: Woolworths (Feb 10), Boundary Store (Feb 12)
            expect(result.length).toBe(2);
        });

        it('text search + highValue combines correctly', () => {
            let result = Logic.applyHighValueFilter(slips);
            result = Logic.applyTextSearch(result, 'shell');
            // High value: Shell (750), Makro (2500). Text "shell" matches Shell only.
            expect(result.length).toBe(1);
            expect(result[0].merchant).toBe('Shell Garage');
        });

        it('all filters combined with no matches returns empty array', () => {
            const mockDate = new Date('2026-02-15');
            let result = Logic.applyThisMonthFilter(slips, mockDate);
            result = Logic.applyHighValueFilter(result);
            result = Logic.applyTextSearch(result, 'nonexistent');
            expect(result.length).toBe(0);
        });
    });

    describe('Filter then Sort pipeline', () => {
        it('should filter first then sort by amount', () => {
            const mockDate = new Date('2026-02-15');
            let result = Logic.applyThisMonthFilter(slips, mockDate);
            result = Logic.sortSlips(result, 'amount');
            // Feb slips sorted by amount desc: Boundary (500), Woolworths (345.90), Steers (89.50)
            expect(result[0].total).toBe(500);
            expect(result[result.length - 1].total).toBe(89.50);
        });
    });

    describe('Needs Review Filter integration', () => {
        it('should combine with category filter', () => {
            let result = Logic.applyNeedsReviewFilter(slips);
            // Needs review: not tax invoice OR compliance not Valid/Sufficient
            // Steers: is_tax_invoice=false → included
            // All others: valid/sufficient → excluded
            result = Logic.applyCategoryFilter(result, 'Entertainment');
            expect(result.length).toBe(1);
            expect(result[0].merchant).toBe('Steers');
        });
    });
});
