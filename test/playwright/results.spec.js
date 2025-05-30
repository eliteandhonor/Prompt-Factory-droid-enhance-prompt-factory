// Playwright E2E tests for Results (add, view, delete, long text, popup)
const { test, expect } = require('@playwright/test');

/**
 * Adds a result to the first prompt and returns the result text.
 * @param {import('@playwright/test').Page} page
 * @param {string} resultText
 */
async function addResult(page, resultText) {
  // Open first prompt
  await page.goto('/');
  await page.click('[data-testid="prompt-title"]');
  // Add result
  await page.fill('#results-list ~ form textarea[name="value"]', resultText);
  await page.click('#results-list ~ form button[type="submit"]');
  // Wait for result to appear
  await expect(page.locator('#results-list')).toContainText(resultText);
}

/**
 * Views the first result in a popup/modal.
 * @param {import('@playwright/test').Page} page
 * @param {string} resultText
 */
async function viewResultPopup(page, resultText) {
  const viewBtn = await page.$('#results-list .view-result-btn');
  if (viewBtn) {
    await viewBtn.click();
    // Modal should appear with resultText
    await expect(page.locator('#result-modal-content')).toContainText(resultText);
    // Close modal
    await page.click('#close-result-modal-btn');
  }
}

/**
 * Deletes the first result in the list.
 * @param {import('@playwright/test').Page} page
 */
async function deleteFirstResult(page) {
  const firstDeleteBtn = await page.$('#results-list .delete-result-btn');
  if (firstDeleteBtn) {
    await firstDeleteBtn.click();
    // Confirm dialog
    await page.waitForTimeout(100);
    await page.keyboard.press('Enter');
  }
}

test.describe('Results', () => {
  test.beforeEach(async ({ page }) => {
    // Capture and print all browser console logs for maximum debug output
    page.on('console', msg => {
      console.log(`[BROWSER][${msg.type()}]`, msg.text());
    });
  });

  test('can add, view (popup), and delete a result (including long text)', async ({ page }) => {
    const resultText = 'Playwright test result ' + Date.now() + '\n' + 'A'.repeat(500);
    await addResult(page, resultText);
    await viewResultPopup(page, resultText);
    await deleteFirstResult(page);
    // Result should be gone
    await expect(page.locator('#results-list')).not.toContainText(resultText);
  });
});