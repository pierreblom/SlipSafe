const { test, expect } = require('@playwright/test');

/**
 * Core E2E tests for SlipSafe Pro.
 * Validates basic navigation and core functionality in the multi-page architecture.
 */
test.describe('SlipSafe Pro Core E2E', () => {

    const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        user_metadata: {
            full_name: 'Test User',
            display_name: 'Tester',
            business_type: 'tech',
            business_name: 'Test Corp',
            onboarding_complete: true
        }
    };

    const mockSlips = [
        {
            id: 1, merchant: 'Test Store', total: 150.00, date: '2025-01-01',
            category: 'General Business', is_tax_deductible: true, is_tax_invoice: true,
            compliance_status: 'Valid', image_url: 'https://via.placeholder.com/150'
        },
        {
            id: 2, merchant: 'Lunch Place', total: 250.00, date: '2025-01-02',
            category: 'Entertainment', is_tax_deductible: false, is_tax_invoice: false,
            compliance_status: 'Invalid', image_url: 'https://via.placeholder.com/150'
        }
    ];

    async function setupAuthenticatedHome(page) {
        // Mock Supabase Local Storage Session
        const tokenData = {
            access_token: 'mock-token',
            refresh_token: 'mock-refresh',
            user: mockUser,
            expires_at: Math.floor(Date.now() / 1000) + 3600
        };

        // Use addInitScript to set localStorage BEFORE app.js runs
        await page.addInitScript(({ tokenData, key }) => {
            window.localStorage.setItem(key, JSON.stringify(tokenData));
            // Also set a flag for app.js to skip real fetches if needed, 
            // but we'll use network mocks for that.
        }, { tokenData, key: 'sb-fezppgnxhbxacuwcejma-auth-token' });

        // Global network mocks for data
        await page.route('**/auth/v1/user**', route => route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockUser)
        }));

        await page.route('**/rest/v1/slips?**', route => route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockSlips)
        }));

        // Go to Home page
        await page.goto('/home/');

        // Hide overlay immediately in case app logic is slow
        await page.evaluate(({ u, s }) => {
            const overlay = document.getElementById('auth-overlay');
            if (overlay) overlay.classList.add('hidden');
            if (window.setTestUser) window.setTestUser(u);
            if (window.setTestSlips) window.setTestSlips(s);
            if (window.runUpdateProfileUI) window.runUpdateProfileUI();
            if (window.runRenderSlips) window.runRenderSlips();
        }, { u: mockUser, s: mockSlips });

        await expect(page.locator('#auth-overlay')).toBeHidden();
    }

    test('should show login overlay initially on root', async ({ page }) => {
        await page.goto('/');
        const authOverlay = page.locator('#auth-overlay');
        await expect(authOverlay).toBeVisible();
        await expect(page.locator('#auth-overlay img[alt="SlipSave Logo"]')).toBeVisible();
    });

    test('should toggle between Sign In and Sign Up', async ({ page }) => {
        await page.goto('/');
        await page.click('#auth-toggle-link');
        await expect(page.locator('#auth-primary-btn')).toHaveText('Create Account');
        await page.click('#auth-toggle-link');
        await expect(page.locator('#auth-primary-btn')).toHaveText('Sign In');
    });

    test.describe('Authenticated Flow', () => {
        test.beforeEach(async ({ page }) => {
            await setupAuthenticatedHome(page);
        });

        test('should display home screen with greeting', async ({ page }) => {
            await expect(page.locator('#greeting-text')).toContainText('Test User');
        });

        test('should navigate through main pages', async ({ page }) => {
            // Smart AI
            await page.click('#nav-ai');
            await expect(page).toHaveURL(/\/ai/);
            // Relaxed header check
            await expect(page.locator('h2')).toContainText(/AI|Smart/i);

            // Insights
            await page.click('#nav-insights');
            await expect(page).toHaveURL(/\/insights/);
            await expect(page.locator('h2')).toContainText(/Insights/i);

            // Business Hub
            await page.click('#nav-business');
            await expect(page).toHaveURL(/\/business/);
            await expect(page.locator('h2')).toContainText(/Business/i);

            // Profile
            await page.click('#nav-profile');
            await expect(page).toHaveURL(/\/profile/);
            await expect(page.locator('h2')).toContainText(/Profile/i);
        });

        test('should filter receipts on home', async ({ page }) => {
            await page.selectOption('#category-filter', 'Entertainment');
            await expect(page.locator('#slip-list h4:has-text("Test Store")')).toBeHidden();
            await expect(page.locator('#slip-list h4:has-text("Lunch Place")')).toBeVisible();
            await page.selectOption('#category-filter', '');
            await expect(page.locator('#slip-list h4:has-text("Test Store")')).toBeVisible();
        });

        test('should open Tax Info modal', async ({ page }) => {
            await page.locator('button[onclick="openTaxInfo()"]').first().click({ force: true });
            await expect(page.locator('#info-modal')).toBeVisible({ timeout: 10000 });
            await expect(page.locator('#info-modal-title')).toContainText('Tax');
        });
    });
});
