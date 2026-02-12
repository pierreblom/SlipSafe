// Shared test fixtures for SlipSafe Pro

export const mockSlips = [
    {
        id: 1,
        merchant: 'Woolworths',
        total: 345.90,
        vat: 45.12,
        date: '2026-02-10',
        category: 'General Business',
        is_tax_deductible: true,
        is_tax_invoice: true,
        compliance_status: 'Valid',
        vat_number: '4040109441'
    },
    {
        id: 2,
        merchant: 'Steers',
        total: 89.50,
        vat: 11.63,
        date: '2026-02-05',
        category: 'Entertainment',
        is_tax_deductible: false,
        is_tax_invoice: false,
        compliance_status: 'Invalid'
    },
    {
        id: 3,
        merchant: 'Shell Garage',
        total: 750.00,
        vat: 97.83,
        date: '2026-01-15',
        category: 'Travel',
        is_tax_deductible: true,
        is_tax_invoice: true,
        compliance_status: 'Valid'
    },
    {
        id: 4,
        merchant: 'Makro',
        total: 2500.00,
        vat: 326.09,
        date: '2025-12-20',
        category: 'Stock',
        is_tax_deductible: true,
        is_tax_invoice: true,
        compliance_status: 'Sufficient'
    },
    // Special case: boundary for High Value (exactly 500)
    {
        id: 5,
        merchant: 'Boundary Store',
        total: 500.00,
        vat: 65.22,
        date: '2026-02-12',
        category: 'General Business',
        is_tax_deductible: true,
        is_tax_invoice: true,
        compliance_status: 'Valid'
    },
];

export const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
    user_metadata: {
        business_name: 'Test Corp',
        onboarding_complete: true
    }
};
