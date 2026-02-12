const { test, expect } = require('@playwright/test');

/**
 * E2E tests for Export Flow (Phase 3).
 * Tests the export modal, CSV download trigger, and error handling.
 */
test.describe('Export Flow E2E', () => {

    async function setupAuthenticatedHome(page) {
        await page.goto('/home/');
        await expect(page.locator('#auth-overlay')).toBeVisible();

        await page.evaluate(() => {
            const mockUser = {
                id: 'test-user-id',
                email: 'test@example.com',
                user_metadata: {
                    full_name: 'Test User',
                    business_name: 'Test Corp',
                    onboarding_complete: true
                }
            };

            const mockSlips = [
                {
                    id: 1, merchant: 'Woolworths', total: 345.90, vat: 45.12, date: '2026-02-10',
                    category: 'General Business', is_tax_deductible: true, is_tax_invoice: true,
                    compliance_status: 'Valid', vat_number: '4040109441'
                },
                {
                    id: 2, merchant: 'Steers', total: 89.50, vat: 11.63, date: '2026-02-05',
                    category: 'Entertainment', is_tax_deductible: false, is_tax_invoice: false,
                    compliance_status: 'Invalid'
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

    test('export button should be visible on home screen', async ({ page }) => {
        await setupAuthenticatedHome(page);
        await expect(page.locator('#export-btn')).toBeVisible();
    });

    test('clicking export button opens modal with export options', async ({ page }) => {
        await setupAuthenticatedHome(page);

        await page.click('#export-btn');

        const exportModal = page.locator('#export-modal');
        await expect(exportModal).toBeVisible();

        // Should show CSV option
        await expect(exportModal.locator('h4:has-text("CSV")')).toBeVisible();
        // Should show PDF option
        await expect(exportModal.locator('h4:has-text("PDF")')).toBeVisible();
    });

    test('clicking CSV triggers file download', async ({ page }) => {
        await setupAuthenticatedHome(page);

        await page.click('#export-btn');
        await expect(page.locator('#export-modal')).toBeVisible();

        // Wait for download event
        const downloadPromise = page.waitForEvent('download');
        await page.click('button[onclick="exportToCSV()"]');
        const download = await downloadPromise;

        expect(download.suggestedFilename()).toContain('SlipSafe_Export');
        expect(download.suggestedFilename()).toContain('.csv');
    });

    test('export modal closes after selecting an option', async ({ page }) => {
        await setupAuthenticatedHome(page);

        await page.click('#export-btn');
        await expect(page.locator('#export-modal')).toBeVisible();

        // Use CSV as the option (since it's simplest)
        const downloadPromise = page.waitForEvent('download');
        await page.click('button[onclick="exportToCSV()"]');
        await downloadPromise;

        // Modal should close after export
        await expect(page.locator('#export-modal')).toBeHidden();
    });
});
