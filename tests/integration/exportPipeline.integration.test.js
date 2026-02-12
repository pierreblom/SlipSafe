import { describe, it, expect } from 'vitest';
import * as Logic from '@/logic.js';
import { mockSlips } from '../fixtures.js';

/**
 * Integration tests for the export pipeline.
 * Verifies: filters → getFilteredSlips logic → export formatter.
 */
describe('Export Pipeline Integration', () => {

    describe('Filtered export produces correct output', () => {
        it('CSV export of filtered slips should only contain filtered data', () => {
            // Simulate filtering to tax deductible only
            const filtered = Logic.applyTaxDeductibleFilter(mockSlips);
            const csv = Logic.buildCsvContent(filtered);

            // Steers is NOT tax deductible → should NOT appear
            expect(csv).not.toContain('Steers');

            // Others should appear
            expect(csv).toContain('Woolworths');
            expect(csv).toContain('Shell Garage');
            expect(csv).toContain('Makro');
        });

        it('PDF summary of filtered slips calculates only filtered totals', () => {
            const filtered = Logic.applyHighValueFilter(mockSlips);
            const summary = Logic.calculatePdfSummary(filtered);

            // High value (>500): Shell (750) + Makro (2500) = 3250
            expect(summary.totalSpent).toBeCloseTo(3250.00);
            expect(Object.keys(summary.categories)).toEqual(['Travel', 'Stock']);
        });

        it('empty filtered result produces empty CSV', () => {
            const filtered = Logic.applyTextSearch(mockSlips, 'nonexistent_store');
            const csv = Logic.buildCsvContent(filtered);
            expect(csv).toBe('');
        });

        it('empty filtered result produces zero PDF summary', () => {
            const filtered = Logic.applyTextSearch(mockSlips, 'nonexistent_store');
            const summary = Logic.calculatePdfSummary(filtered);
            expect(summary.totalSpent).toBe(0);
            expect(summary.totalVat).toBe(0);
            expect(summary.deductibleTotal).toBe(0);
            expect(Object.keys(summary.categories).length).toBe(0);
        });
    });

    describe('CSV correctness for special characters', () => {
        it('should escape merchant names with commas', () => {
            const slipsWithComma = [
                { ...mockSlips[0], merchant: 'Store, Inc' }
            ];
            const csv = Logic.buildCsvContent(slipsWithComma);
            // Merchant should be wrapped in quotes
            expect(csv).toContain('"Store, Inc"');
        });

        it('should escape merchant names with double quotes', () => {
            const slipsWithQuote = [
                { ...mockSlips[0], merchant: 'The "Best" Store' }
            ];
            const csv = Logic.buildCsvContent(slipsWithQuote);
            // Double quotes should be doubled inside CSV
            expect(csv).toContain('"The ""Best"" Store"');
        });
    });
});
