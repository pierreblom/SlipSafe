// Pure logic functions for SlipSafe Pro - Extracted for testability
// Uses UMD pattern to work in both Browser (window.Logic) and Node/Vitest (module.exports)

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.Logic = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {

    // --- FILTERS ---

    function getMonthYearFromDate(dateStr) {
        if (!dateStr) return { month: -1, year: -1 };
        const d = new Date(dateStr);
        return { month: d.getMonth(), year: d.getFullYear() };
    }

    function applyThisMonthFilter(slips, currentDate = new Date()) {
        const curMonth = currentDate.getMonth();
        const curYear = currentDate.getFullYear();
        return slips.filter(s => {
            const { month, year } = getMonthYearFromDate(s.date);
            return month === curMonth && year === curYear;
        });
    }

    function applyHighValueFilter(slips, threshold = 500) {
        return slips.filter(s => (s.total || 0) > threshold);
    }

    function applyTaxDeductibleFilter(slips) {
        return slips.filter(s => s.is_tax_deductible === true);
    }

    function applyDateRangeFilter(slips, start, end) {
        if (!start || !end) return slips;
        return slips.filter(s => s.date >= start && s.date <= end);
    }

    function applyNeedsReviewFilter(slips) {
        return slips.filter(s =>
            !s.is_tax_invoice ||
            (s.compliance_status && s.compliance_status !== 'Valid' && s.compliance_status !== 'Sufficient')
        );
    }

    function applyCategoryFilter(slips, category) {
        if (!category) return slips;
        return slips.filter(s => s.category === category);
    }

    function applyTextSearch(slips, searchTerm) {
        if (!searchTerm || !searchTerm.trim()) return slips;

        const term = searchTerm.toLowerCase().trim();

        // Smart amount-based search (e.g., "over R100", "under R50")
        const overMatch = term.match(/(?:over|above|more than|greater than)\s*r?\s*(\d+(?:\.\d+)?)/i);
        const underMatch = term.match(/(?:under|below|less than)\s*r?\s*(\d+(?:\.\d+)?)/i);
        const exactAmountMatch = term.match(/^r?\s*(\d+(?:\.\d+)?)$/i);

        return slips.filter(s => {
            const total = s.total || 0;

            if (overMatch) return total > parseFloat(overMatch[1]);
            if (underMatch) return total < parseFloat(underMatch[1]);
            if (exactAmountMatch) return Math.abs(total - parseFloat(exactAmountMatch[1])) < 1;

            return (
                (s.date || '').toLowerCase().includes(term) ||
                (s.merchant || '').toLowerCase().includes(term) ||
                (s.category || '').toLowerCase().includes(term) ||
                (s.vat_number || '').toLowerCase().includes(term) ||
                (Array.isArray(s.notes) ? s.notes.join(' ').toLowerCase() : '').includes(term)
            );
        });
    }

    function sortSlips(slips, sortBy) {
        return [...slips].sort((a, b) => {
            if (sortBy === 'date') {
                return new Date(b.date) - new Date(a.date);
            } else if (sortBy === 'amount') {
                return (b.total || 0) - (a.total || 0);
            } else if (sortBy === 'merchant') {
                return (a.merchant || '').localeCompare(b.merchant || '');
            }
            return 0;
        });
    }

    // --- EXPORT FORMATTERS ---

    function buildCsvContent(slips) {
        if (!slips || slips.length === 0) return '';

        const headers = ['Date', 'Merchant', 'VAT Number', 'Category', 'Total (ZAR)', 'VAT (ZAR)', 'Tax Deductible', 'Compliance'];
        const rows = slips.map(s => [
            s.date || '',
            `"${(s.merchant || '').replace(/"/g, '""')}"`,
            s.vat_number || 'N/A',
            s.category || '',
            (s.total || 0).toFixed(2),
            (s.vat || 0).toFixed(2),
            s.is_tax_deductible ? 'YES' : 'NO',
            s.compliance_status || 'Unknown'
        ]);

        return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    }

    function calculatePdfSummary(slips) {
        const totalSpent = slips.reduce((sum, s) => sum + (s.total || 0), 0);
        const totalVat = slips.reduce((sum, s) => sum + (s.vat || 0), 0);

        const deductibleSlips = slips.filter(s => s.is_tax_deductible);
        const deductibleTotal = deductibleSlips.reduce((sum, s) => sum + (s.total || 0), 0);

        const categories = {};
        slips.forEach(s => {
            const cat = s.category || 'Other';
            if (!categories[cat]) categories[cat] = { count: 0, total: 0 };
            categories[cat].count++;
            categories[cat].total += (s.total || 0);
        });

        return { totalSpent, totalVat, deductibleTotal, categories };
    }

    // --- ONBOARDING VALIDATION ---

    function validateBusinessName(name) {
        return typeof name === 'string';
    }

    function validateBudget(amount) {
        if (amount === '' || amount === null) return true;
        const num = parseFloat(amount);
        return !isNaN(num) && num >= 0;
    }

    return {
        applyThisMonthFilter,
        applyHighValueFilter,
        applyTaxDeductibleFilter,
        applyDateRangeFilter,
        applyNeedsReviewFilter,
        applyCategoryFilter,
        applyTextSearch,
        sortSlips,
        buildCsvContent,
        calculatePdfSummary,
        validateBusinessName,
        validateBudget,
        getMonthYearFromDate
    };
}));
