// Playwright E2E tests for edge cases (long input, network errors, etc.)
const { test, expect } = require('@playwright/test');

test.describe('Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    // Capture and print all browser console logs for maximum debug output
    page.on('console', msg => {
      console.log(`[BROWSER][${msg.type()}]`, msg.text());
    });
  });

  test('handles very long comment input gracefully', async ({ page }) => {
    await page.goto('/');
    await page.click('[data-testid="prompt-title"]');
    const longComment = 'A'.repeat(2000);
    await page.fill('#comments-section input[name="text"]', longComment);
    await page.click('#comments-section button[type="submit"]');
    // Should appear in the list, truncated or scrollable
    await expect(page.locator('#comments-list')).toContainText(longComment.slice(0, 100));
  });

  test('handles very long result input gracefully', async ({ page }) => {
    await page.goto('/');
    await page.click('[data-testid="prompt-title"]');
    const longResult = 'B'.repeat(3000);
    await page.fill('#results-list ~ form textarea[name="value"]', longResult);
    await page.click('#results-list ~ form button[type="submit"]');
    // Should appear in the list, truncated or scrollable
    await expect(page.locator('#results-list')).toContainText(longResult.slice(0, 100));
  });

  test('shows error feedback for network error on comment delete', async ({ page }) => {
    await page.goto('/');
    await page.click('[data-testid="prompt-title"]');
    // Add a comment to delete
    await page.fill('#comments-section input[name="text"]', 'To be deleted');
    await page.click('#comments-section button[type="submit"]');
    await expect(page.locator('#comments-list')).toContainText('To be deleted');
    // Simulate network error on delete
    await page.route('/api/comments.php*', route => route.abort());
    const firstDeleteBtn = await page.$('#comments-list .delete-comment-btn');
    if (firstDeleteBtn) {
      await firstDeleteBtn.click();
      await page.waitForTimeout(100);
      await page.keyboard.press('Enter');
      await expect(page.locator('.toast, [role="alert"]')).toBeVisible();
    }
    await page.unroute('/api/comments.php*');
  });

  test('shows error feedback for network error on result delete', async ({ page }) => {
    await page.goto('/');
    await page.click('[data-testid="prompt-title"]');
    // Add a result to delete
    await page.fill('#results-list ~ form textarea[name="value"]', 'To be deleted');
    await page.click('#results-list ~ form button[type="submit"]');
    await expect(page.locator('#results-list')).toContainText('To be deleted');
    // Simulate network error on delete
    await page.route('/api/results.php*', route => route.abort());
    const firstDeleteBtn = await page.$('#results-list .delete-result-btn');
    if (firstDeleteBtn) {
      await firstDeleteBtn.click();
      await page.waitForTimeout(100);
      await page.keyboard.press('Enter');
      await expect(page.locator('.toast, [role="alert"]')).toBeVisible();
    }
    await page.unroute('/api/results.php*');
  });
});
// --- Audit: Tag/Category Filtering & Deleted Reference UI Edge Cases ---
const { test: auditTest, expect: auditExpect } = require('@playwright/test');

auditTest.describe('Prompt filtering and deleted tag/category UI', () => {
  auditTest('shows prompts with deleted tag/category and displays correct UI', async ({ page }) => {
    // Setup: Go to homepage and create a prompt with a unique tag and category
    await page.goto('/');
    // Add a new tag and category via UI or API (simulate if needed)
    const uniqueTag = 'audit-tag-' + Date.now();
    const uniqueCat = 'audit-cat-' + Date.now();

    // Open add prompt modal
    await page.click('#add-prompt-btn');
    await page.fill('input[name="title"]', 'Audit Test Prompt');
    await page.fill('textarea[name="content"]', 'Prompt for deleted tag/category audit.');
    // Add tag and category (simulate UI selectors, may need to adapt to actual UI)
    await page.fill('input[name="tags"]', uniqueTag);
    await page.fill('input[name="category"]', uniqueCat);
    await page.click('button[type="submit"]');

    // Wait for prompt to appear
    await auditExpect(page.locator('[data-testid="prompt-title"]')).toContainText('Audit Test Prompt');

    // Simulate deletion of tag and category (remove from backend or via API/UI)
    // For this test, assume we can remove from localStorage or via a test API endpoint
    await page.evaluate((tag, cat) => {
      // Remove tag and category from localStorage or window state (simulate backend deletion)
      if (window.app) {
        if (window.app.allTags) {
          window.app.allTags = window.app.allTags.filter(t => t.name !== tag);
        }
        if (window.app.allCategories) {
          window.app.allCategories = window.app.allCategories.filter(c => c.name !== cat);
        }
      }
    }, uniqueTag, uniqueCat);

    // Filter by the deleted tag
    await page.click(`[data-testid="tag-pill-"]`, { force: true }).catch(() => {}); // fallback if not clickable
    // The prompt should still be visible
    await auditExpect(page.locator('[data-testid="prompt-title"]')).toContainText('Audit Test Prompt');
    // The tag pill should show "Deleted Tag" with info icon and tooltip
    const tagPill = page.locator('.tag-pill', { hasText: 'Deleted Tag' });
    await auditExpect(tagPill).toBeVisible();
    await auditExpect(tagPill).toHaveAttribute('title', /deleted/i);

    // Filter by the deleted category
    await page.click(`[data-testid="category-pill-"]`, { force: true }).catch(() => {});
    await auditExpect(page.locator('[data-testid="prompt-title"]')).toContainText('Audit Test Prompt');
    // The category pill should show "Deleted Category" with info icon and tooltip
    const catPill = page.locator('.category-pill', { hasText: 'Deleted Category' });
    await auditExpect(catPill).toBeVisible();
    await auditExpect(catPill).toHaveAttribute('title', /deleted/i);
  });
});