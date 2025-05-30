// Example E2E test for homepage using Playwright

const { test, expect } = require('@playwright/test');

test('homepage loads and shows page title', async ({ page }) => {
  // Capture and print all browser console logs for maximum debug output
  page.on('console', msg => {
    console.log(`[BROWSER][${msg.type()}]`, msg.text());
  });

  // Navigate to the base URL (root served by PHP dev server)
  await page.goto('/');

  // Wait for app initialization (window.app hook)
  await page.waitForFunction(() => window.app !== undefined);

  // Wait for page load and check title present
  await expect(page).toHaveTitle(/.+/);

  // Optionally, check that a known element (e.g. main, h1, or .container) exists
  // Adjust selector as needed for your app structure
  const mainOrHeading = await page.locator('main, h1, .container').first();
  await expect(mainOrHeading).toBeVisible();
});