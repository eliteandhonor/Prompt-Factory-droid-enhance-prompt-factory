// Playwright E2E tests for modal accessibility and error feedback
const { test, expect } = require('@playwright/test');

test.describe('Modal Accessibility & Error Feedback', () => {
  test.beforeEach(async ({ page }) => {
    // Capture and print all browser console logs for maximum debug output
    page.on('console', msg => {
      console.log(`[BROWSER][${msg.type()}]`, msg.text());
    });
  });

  test('modals open and close via keyboard (Escape)', async ({ page }) => {
    await page.goto('/');
    // Open first prompt modal
    await page.click('[data-testid="prompt-title"]');
    // Modal should be visible
    await expect(page.locator('.modal.active')).toBeVisible();
    // Press Escape to close
    await page.keyboard.press('Escape');
    // Modal should be hidden
    await expect(page.locator('.modal.active')).not.toBeVisible();
  });

  test('shows error feedback for failed comment add', async ({ page }) => {
    await page.goto('/');
    await page.click('[data-testid="prompt-title"]');
    // Simulate network error by disabling network
    await page.route('/api/comments.php', route => route.abort());
    await page.fill('#comments-section input[name="text"]', 'Should fail');
    await page.click('#comments-section button[type="submit"]');
    // Should show error toast or inline error
    await expect(page.locator('.toast, [role="alert"]')).toBeVisible();
    // Restore network for other tests
    await page.unroute('/api/comments.php');
  });

  test('shows error feedback for failed result add', async ({ page }) => {
    await page.goto('/');
    await page.click('[data-testid="prompt-title"]');
    // Simulate network error by disabling network
    await page.route('/api/results.php', route => route.abort());
    await page.fill('#results-list ~ form textarea[name="value"]', 'Should fail');
    await page.click('#results-list ~ form button[type="submit"]');
    // Should show error toast or inline error
    await expect(page.locator('.toast, [role="alert"]')).toBeVisible();
    // Restore network for other tests
    await page.unroute('/api/results.php');
  });
});