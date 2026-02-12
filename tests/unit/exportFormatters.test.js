import { describe, it, expect } from 'vitest';
import * as Logic from '@/logic.js';
import { mockSlips } from '../fixtures.js';

describe('Export Formatters', () => {
    describe('CSV Builder', () => {
        it('should include correct headers', () => {
            const csv = Logic.buildCsvContent(mockSlips);
            const headers = csv.split('\n')[0];
            expect(headers).toBe('Date,Merchant,VAT Number,Category,Total (ZAR),VAT (ZAR),Tax Deductible,Compliance');
        });

        it('should format totals to 2 decimal places', () => {
            const csv = Logic.buildCsvContent([mockSlips[0]]);
            const row = csv.split('\n')[1];
            expect(row).toContain('345.90');
            expect(row).toContain('45.12');
        });

        it('should output YES/NO for tax deductible field', () => {
            // mockSlips[0] is true, mockSlips[1] is false
            const csv = Logic.buildCsvContent(mockSlips);
            const rows = csv.split('\n');
            const row1 = rows[1]; // Woolworths (True)
            const row2 = rows[2]; // Steers (False)

            expect(row1).toContain('YES');
            expect(row2).toContain('NO');
        });

        it('should handle empty slips array gracefully', () => {
            const csv = Logic.buildCsvContent([]);
            expect(csv).toBe('');
        });
    });

    describe('PDF Summary Calculator', () => {
        it('should calculate total spent correctly', () => {
            const summary = Logic.calculatePdfSummary(mockSlips);
            // 345.90 + 89.50 + 750.00 + 2500.00 + 500.00
            // = 4185.40
            expect(summary.totalSpent).toBeCloseTo(4185.40);
        });

        it('should calculate total VAT correctly', () => {
            const summary = Logic.calculatePdfSummary(mockSlips);
            // 45.12 + 11.63 + 97.83 + 326.09 + 65.22
            // = 545.89
            expect(summary.totalVat).toBeCloseTo(545.89);
        });

        it('should calculate deductible total from only deductible slips', () => {
            const summary = Logic.calculatePdfSummary(mockSlips);
            // Deductible: Woolworths (345.90), Shell (750), Makro (2500), Boundary (500)
            // Exclude: Steers (89.50)
            // Total: 4095.90
            expect(summary.deductibleTotal).toBeCloseTo(4095.90);
        });

        it('should group by category with count and total', () => {
            const summary = Logic.calculatePdfSummary(mockSlips);

            // "General Business": Woolworths (345.90) + Boundary (500) = 845.90
            const genBiz = summary.categories['General Business'];
            expect(genBiz.count).toBe(2);
            expect(genBiz.total).toBeCloseTo(845.90);

            // "Entertainment": Steers (89.50)
            const ent = summary.categories['Entertainment'];
            expect(ent.count).toBe(1);
            expect(ent.total).toBeCloseTo(89.50);
        });
    });
});
