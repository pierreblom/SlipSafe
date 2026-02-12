const { test, expect } = require('@playwright/test');

/**
 * E2E tests for Smart Filter Chips (Phase 3).
 * Tests real browser interactions: clicking chips, verifying filtered slip list.
 */
test.describe('Smart Filter Chips E2E', () => {

    // Helper to mock auth and inject test slips
    async function setupAuthenticatedHome(page) {
        await page.goto('/home/');
        await expect(page.locator('#auth-overlay')).toBeVisible();

        await page.evaluate(() => {
            const mockUser = {
                id: 'test-user-id',
                email: 'test@example.com',
                user_metadata: {
                    full_name: 'Test User',
                    onboarding_complete: true
                }
            };

            const now = new Date();
            const curYear = now.getFullYear();
            const curMonth = String(now.getMonth() + 1).padStart(2, '0');
            const curDay = String(now.getDate()).padStart(2, '0');
            const thisMonthDate = `${curYear}-${curMonth}-${curDay}`;
            const lastMonthDate = `${curYear}-${String(now.getMonth()).padStart(2, '0')}-15`;

            const mockSlips = [
                {
                    id: 1, merchant: 'Woolworths', total: 345.90, vat: 45.12, date: thisMonthDate,
                    category: 'General Business', is_tax_deductible: true, is_tax_invoice: true,
                    compliance_status: 'Valid', vat_number: '4040109441'
                },
                {
                    id: 2, merchant: 'Steers', total: 89.50, vat: 11.63, date: thisMonthDate,
                    category: 'Entertainment', is_tax_deductible: false, is_tax_invoice: false,
                    compliance_status: 'Invalid'
                },
                {
                    id: 3, merchant: 'Shell Garage', total: 750.00, vat: 97.83, date: lastMonthDate,
                    category: 'Travel', is_tax_deductible: true, is_tax_invoice: true,
                    compliance_status: 'Valid'
                },
                {
                    id: 4, merchant: 'Makro', total: 2500.00, vat: 326.09, date: lastMonthDate,
                    category: 'Stock', is_tax_deductible: true, is_tax_invoice: true,
                    compliance_status: 'Sufficient'
                },
            ];

            if (window.setTestUser) window.setTestUser(mockUser);
            if (window.setTestSlips) window.setTestSlips(mockSlips);
            document.getElementById('auth-overlay').classList.add('hidden');
            if (window.runUpdateProfileUI) window.runUpdateProfileUI();
            if (window.runRenderSlips) window.runRenderSlips();

            if (window.getSupabaseClient) {
                const client = window.getSupabaseClient();
                client.auth.getUser = async () => ({ data: { user: mockUser } });
            }
            // Prevent background fetches from overwriting our mocks
            window.fetchSlips = async () => { console.log('fetchSlips suppressed in E2E'); };
        });

        // Ensure overlay is hidden before proceeding
        await expect(page.locator('#auth-overlay')).toBeHidden();
    }

    test('filter chips should be visible on home screen', async ({ page }) => {
        await setupAuthenticatedHome(page);
        await expect(page.locator('.chip-bar')).toBeVisible();
        await expect(page.locator('#chip-thisMonth')).toBeVisible();
        await expect(page.locator('#chip-highValue')).toBeVisible();
        await expect(page.locator('#chip-taxDeductible')).toBeVisible();
    });

    test('clicking "This Month" chip should filter to current month receipts', async ({ page }) => {
        await setupAuthenticatedHome(page);

        // All 4 slips visible initially
        await expect(page.locator('#slip-list h4:has-text("Woolworths")')).toBeVisible();
        await expect(page.locator('#slip-list h4:has-text("Shell Garage")')).toBeVisible();

        // Click "This Month" chip
        await page.click('#chip-thisMonth');

        // Wait for filter to apply
        await expect(page.locator('#slip-list h4:has-text("Woolworths")')).toBeVisible();
        await expect(page.locator('#slip-list h4:has-text("Steers")')).toBeVisible();
        // Last month receipts should be hidden
        await expect(page.locator('#slip-list h4:has-text("Shell Garage")')).toBeHidden();
        await expect(page.locator('#slip-list h4:has-text("Makro")')).toBeHidden();
    });

    test('clicking "High Value" chip should show only receipts over R500', async ({ page }) => {
        await setupAuthenticatedHome(page);

        await page.click('#chip-highValue');

        // Only Shell (750) and Makro (2500) should be visible
        await expect(page.locator('#slip-list h4:has-text("Shell Garage")')).toBeVisible();
        await expect(page.locator('#slip-list h4:has-text("Makro")')).toBeVisible();
        await expect(page.locator('#slip-list h4:has-text("Woolworths")')).toBeHidden();
        await expect(page.locator('#slip-list h4:has-text("Steers")')).toBeHidden();
    });

    test('clicking "Tax Deductible" chip shows only deductible receipts', async ({ page }) => {
        await setupAuthenticatedHome(page);

        await page.click('#chip-taxDeductible');

        // Steers is NOT tax deductible
        await expect(page.locator('#slip-list h4:has-text("Steers")')).toBeHidden();
        // Others are deductible
        await expect(page.locator('#slip-list h4:has-text("Woolworths")')).toBeVisible();
        await expect(page.locator('#slip-list h4:has-text("Shell Garage")')).toBeVisible();
    });

    test('clicking active chip again should deactivate it', async ({ page }) => {
        await setupAuthenticatedHome(page);

        // Activate
        await page.click('#chip-highValue');
        await expect(page.locator('text=Steers')).toBeHidden();

        // Deactivate
        await page.click('#chip-highValue');
        // All should be visible again
        await expect(page.locator('#slip-list h4:has-text("Steers")')).toBeVisible();
        await expect(page.locator('#slip-list h4:has-text("Woolworths")')).toBeVisible();
    });

    test('clicking "Date Range" chip reveals date picker', async ({ page }) => {
        await setupAuthenticatedHome(page);

        // Date picker should be hidden initially
        await expect(page.locator('#date-range-picker')).toBeHidden();

        // Click date range chip
        await page.click('#chip-dateRange');

        // Date picker should now be visible
        await expect(page.locator('#date-range-picker')).toBeVisible();
    });
});
