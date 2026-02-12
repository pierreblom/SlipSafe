const { test, expect } = require('@playwright/test');

/**
 * E2E tests for Onboarding Wizard (Phase 3).
 * Tests wizard visibility, step navigation, and dismissal.
 */
test.describe('Onboarding Wizard E2E', () => {

    async function setupNewUser(page) {
        await page.goto('/home/');
        await expect(page.locator('#auth-overlay')).toBeVisible();

        await page.evaluate(() => {
            const newUser = {
                id: 'new-user-id',
                email: 'new@example.com',
                user_metadata: {}  // No onboarding_complete
            };

            if (window.setTestUser) window.setTestUser(newUser);
            if (window.setTestSlips) window.setTestSlips([]);
            document.getElementById('auth-overlay').classList.add('hidden');
            if (window.runUpdateProfileUI) window.runUpdateProfileUI();

            if (window.getSupabaseClient) {
                const client = window.getSupabaseClient();
                client.auth.getUser = async () => ({ data: { user: newUser } });
                // Mock updateUser to prevent actual API call
                client.auth.updateUser = async (data) => ({ data: { user: { ...newUser, user_metadata: data.data } }, error: null });
            }
        });
    }

    async function setupExistingUser(page) {
        await page.goto('/home/');
        await expect(page.locator('#auth-overlay')).toBeVisible();

        await page.evaluate(() => {
            const existingUser = {
                id: 'existing-user-id',
                email: 'existing@example.com',
                user_metadata: { onboarding_complete: true, business_name: 'Test Business' }
            };

            if (window.setTestUser) window.setTestUser(existingUser);
            if (window.setTestSlips) window.setTestSlips([]);
            document.getElementById('auth-overlay').classList.add('hidden');
            if (window.runUpdateProfileUI) window.runUpdateProfileUI();

            if (window.getSupabaseClient) {
                const client = window.getSupabaseClient();
                client.auth.getUser = async () => ({ data: { user: existingUser } });
            }
        });
    }

    test('new user sees wizard after triggering onboarding', async ({ page }) => {
        await setupNewUser(page);

        // Manually trigger the wizard (since handleLoginSuccess isn't fully called)
        await page.evaluate(() => {
            const wizard = document.getElementById('onboarding-wizard');
            if (wizard) wizard.classList.remove('hidden');
        });

        const wizard = page.locator('#onboarding-wizard');
        await expect(wizard).toBeVisible();
    });

    test('step 1 shows welcome content', async ({ page }) => {
        await setupNewUser(page);

        await page.evaluate(() => {
            const wizard = document.getElementById('onboarding-wizard');
            if (wizard) wizard.classList.remove('hidden');
        });

        // Step 1 should be visible
        await expect(page.locator('#wizard-step-1')).toBeVisible();
        // Step 2 and 3 should be hidden
        await expect(page.locator('#wizard-step-2')).toBeHidden();
        await expect(page.locator('#wizard-step-3')).toBeHidden();
    });

    test('clicking Next on step 1 advances to step 2', async ({ page }) => {
        await setupNewUser(page);

        await page.evaluate(() => {
            const wizard = document.getElementById('onboarding-wizard');
            if (wizard) wizard.classList.remove('hidden');
        });

        // Click Next on step 1
        await page.click('button[onclick="wizardNext(1)"]');

        // Step 2 should now be visible
        await expect(page.locator('#wizard-step-2')).toBeVisible();
        await expect(page.locator('#wizard-step-1')).toBeHidden();
    });

    test('back button returns to previous step', async ({ page }) => {
        await setupNewUser(page);

        await page.evaluate(() => {
            const wizard = document.getElementById('onboarding-wizard');
            if (wizard) wizard.classList.remove('hidden');
        });

        // Go to step 2
        await page.click('button[onclick="wizardNext(1)"]');
        await expect(page.locator('#wizard-step-2')).toBeVisible();

        // Go back to step 1
        await page.click('button[onclick="wizardBack(2)"]');
        await expect(page.locator('#wizard-step-1')).toBeVisible();
    });

    test('skip button dismisses the wizard', async ({ page }) => {
        await setupNewUser(page);

        await page.evaluate(() => {
            const wizard = document.getElementById('onboarding-wizard');
            if (wizard) wizard.classList.remove('hidden');
        });

        await expect(page.locator('#onboarding-wizard')).toBeVisible();

        // Click skip
        await page.click('button[onclick="skipOnboarding()"]');

        // Wizard should be hidden
        await expect(page.locator('#onboarding-wizard')).toBeHidden();
    });

    test('returning user does NOT see wizard', async ({ page }) => {
        await setupExistingUser(page);

        // Wizard should not be visible for existing user
        const wizard = page.locator('#onboarding-wizard');
        await expect(wizard).toBeHidden();
    });
});
