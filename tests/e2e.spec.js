const { test, expect } = require('@playwright/test');

test.describe('SlipSafe Pro E2E Tests', () => {

    test.beforeEach(async ({ page }) => {
        // Go to the local server
        await page.goto('http://localhost:8080');
    });

    test('should show login overlay initially', async ({ page }) => {
        const authOverlay = page.locator('#auth-overlay');
        await expect(authOverlay).toBeVisible();
        await expect(page.locator('text=SlipSafe Pro')).toBeVisible();
        await expect(page.locator('text=Sign In')).toBeVisible();
    });

    test('should toggle between Sign In and Sign Up', async ({ page }) => {
        await page.click('#auth-toggle-link');
        await expect(page.locator('#auth-primary-btn')).toHaveText('Create Account');
        await expect(page.locator('text=Already have an account?')).toBeVisible();

        await page.click('#auth-toggle-link');
        await expect(page.locator('#auth-primary-btn')).toHaveText('Sign In');
    });

    test.describe('Authenticated User Flow (Mocked)', () => {
        test.beforeEach(async ({ page }) => {
            // Wait for the app to finish initial load (overlay visible)
            await expect(page.locator('#auth-overlay')).toBeVisible();

            // Mock the authentication state by injecting code
            await page.evaluate(() => {
                const mockUser = {
                    id: 'test-user-id',
                    email: 'test@example.com',
                    user_metadata: {
                        full_name: 'Test User',
                        display_name: 'Tester',
                        business_type: 'tech'
                    }
                };

                const mockSlips = [
                    {
                        id: 1,
                        merchant: 'Test Store',
                        total: 150.00,
                        date: '2025-01-01',
                        category: 'General Business',
                        is_tax_deductible: true,
                        image_url: 'https://via.placeholder.com/150',
                        is_tax_invoice: true,
                        compliance_status: 'Valid'
                    },
                    {
                        id: 2,
                        merchant: 'Lunch Place',
                        total: 250.00,
                        date: '2025-01-02',
                        category: 'Entertainment',
                        is_tax_deductible: false,
                        image_url: 'https://via.placeholder.com/150',
                        is_tax_invoice: false,
                        compliance_status: 'Invalid'
                    }
                ];

                // Use exposed functions to set state
                if (window.setTestUser) window.setTestUser(mockUser);
                if (window.setTestSlips) window.setTestSlips(mockSlips);

                // Hide overlay
                document.getElementById('auth-overlay').classList.add('hidden');

                // Trigger UI updates
                if (window.runUpdateProfileUI) window.runUpdateProfileUI();
                if (window.runRenderSlips) window.runRenderSlips();

                // Mock Supabase auth to prevent reversion if checked again
                if (window.getSupabaseClient) {
                    const client = window.getSupabaseClient();
                    client.auth.getUser = async () => ({ data: { user: mockUser } });
                }
            });
        });

        test('should display home screen with greeting', async ({ page }) => {
            // Switch to Home screen first
            await page.click('#nav-home');
            await expect(page.locator('#screen-home')).toHaveClass(/active/);
            await expect(page.locator('#greeting-text')).toContainText('Test User');
        });

        test('should navigate through bottom tabs', async ({ page }) => {
            // Go to Smart AI
            await page.click('#nav-ai');
            await expect(page.locator('#screen-ai')).toHaveClass(/active/);
            await expect(page.locator('h2:has-text("Smart AI Features")')).toBeVisible();

            // Go to Insights
            await page.click('#nav-insights');
            await expect(page.locator('#screen-insights')).toHaveClass(/active/);
            await expect(page.locator('h2:has-text("Expense Insights")')).toBeVisible();

            // Go to Profile
            await page.click('#nav-profile');
            // Verify profile screen is active or nav is active
            await expect(page.locator('#nav-profile')).toHaveClass(/nav-active/);
        });

        test('should switch tabs on Home Screen', async ({ page }) => {
            // Ensure we are on Home
            await page.click('#nav-home');

            // Default is Receipts
            await expect(page.locator('#tab-receipts')).toHaveClass(/border-\[#0077b6\]/);

            // Click Analytics
            await page.click('#tab-analytics');
            await expect(page.locator('#tab-analytics')).toHaveClass(/text-\[#0077b6\]/);
            await expect(page.locator('#analytics-section')).not.toHaveClass(/hidden/);
            await expect(page.locator('#receipts-section')).toHaveClass(/hidden/);

            // Click back to Receipts
            await page.click('#tab-receipts');
            await expect(page.locator('#receipts-section')).not.toHaveClass(/hidden/);
        });

        test('should open Tax Info modal/alert', async ({ page }) => {
            // Ensure we are on Home
            await page.click('#nav-home');

            // Since it's an alert, we need to handle the dialog
            page.on('dialog', dialog => {
                console.log(`Dialog message: ${dialog.message()}`);
                dialog.dismiss();
            });
            // Use a more specific selector or force click if it's being covered
            await page.click('button:has-text("TAX INFO")', { force: true });
        });

        test('should open Scan Receipt file picker', async ({ page }) => {
            // Ensure we are on Home
            await page.click('#nav-home');

            // We can't easily test the native file picker, but we can check if the input exists and is hidden
            const fileInput = page.locator('#file-input');
            await expect(fileInput).toBeAttached();
            await expect(fileInput).toHaveAttribute('type', 'file');
        });

        test('should filter receipts', async ({ page }) => {
            // Ensure we are on Home
            await page.click('#nav-home');
            await expect(page.locator('#screen-home')).toHaveClass(/active/);

            // Filter by Category: Entertainment
            await page.selectOption('#category-filter', 'Entertainment');

            // Wait for the filter to apply (Test Store should disappear)
            await expect(page.locator('text=Test Store')).toBeHidden();

            // Should only see Lunch Place
            await expect(page.locator('text=Lunch Place')).toBeVisible();

            // Reset
            await page.selectOption('#category-filter', '');
            await expect(page.locator('text=Test Store')).toBeVisible();
        });

        test('should show AI Insights', async ({ page }) => {
            await page.click('#nav-ai');
            await expect(page.locator('#screen-ai')).toHaveClass(/active/);

            // Use specific selector to avoid strict mode violation
            await expect(page.locator('#screen-ai h3:has-text("AI Insights")')).toBeVisible();
            // Check if buttons are present
            await expect(page.locator('text=Smart Search')).toBeVisible();
            await expect(page.locator('#screen-ai button:has-text("Scan Receipt")')).toBeVisible();
        });
    });
});
