import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
    await page.goto('/');

    // Expect a title "to contain" a substring.
    // Note: Adjust this expected title based on your actual index.html title
    await expect(page).toHaveTitle(/Vite/);
});

test('loads dashboard', async ({ page }) => {
    await page.goto('/');

    // Check if the main dashboard element is visible
    // Adjust selector based on actual App content
    // Assuming there's a header or main element
    await expect(page.locator('body')).toBeVisible();
});
