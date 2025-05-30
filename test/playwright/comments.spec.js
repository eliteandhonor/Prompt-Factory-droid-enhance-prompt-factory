// Playwright E2E tests for Comments (add, view, delete, error handling)
const { test, expect } = require('@playwright/test');

/**
 * Adds a comment to the first prompt and returns the comment text.
 * @param {import('@playwright/test').Page} page
 * @param {string} commentText
 */
async function addComment(page, commentText) {
  // Open first prompt
  await page.goto('/');
  await page.click('[data-testid="prompt-title"]');
  // Add comment
  await page.fill('#comments-section input[name="text"]', commentText);
  await page.click('#comments-section button[type="submit"]');
  // Wait for comment to appear
  await expect(page.locator('#comments-list')).toContainText(commentText);
}

/**
 * Deletes the comment with the given text.
 * @param {import('@playwright/test').Page} page
 * @param {string} commentText
 */
async function deleteCommentByText(page, commentText) {
  // Find the <li> containing the comment text
  const commentItems = await page.$$('#comments-list li');
  for (const item of commentItems) {
    const text = await item.textContent();
    if (text && text.includes(commentText)) {
      const deleteBtn = await item.$('.delete-comment-btn');
      if (deleteBtn) {
        // Use a locator for the specific comment <li>
        const commentLocator = page.locator('#comments-list li', { hasText: commentText });
        await deleteBtn.click();
        // Confirm dialog
        await page.waitForTimeout(100);
        await page.keyboard.press('Enter');
        // Wait for the comment to be removed from the DOM
        await expect(commentLocator).toHaveCount(0, { timeout: 5000 });
        return true;
      }
    }
  }
  throw new Error('Delete button for comment not found: ' + commentText);
}

/**
 * Checks error handling by submitting an empty comment.
 * @param {import('@playwright/test').Page} page
 */
async function addEmptyComment(page) {
  await page.fill('#comments-section input[name="text"]', '');
  await page.click('#comments-section button[type="submit"]');
  // Should not add a comment, may show error/toast
  await expect(page.locator('#comments-list li')).not.toContainText('');
}

test.describe('Comments', () => {
  test.beforeEach(async ({ page }) => {
    // Capture and print all browser console logs for maximum debug output
    page.on('console', msg => {
      // Print all log types, including debug/info/warn/error
      console.log(`[BROWSER][${msg.type()}]`, msg.text());
    });
  });

  test('can add, view, and delete a comment', async ({ page }) => {
    const commentText = 'Playwright test comment ' + Date.now();
    await addComment(page, commentText);
    // Delete the comment just added
    await deleteCommentByText(page, commentText);
    // Comment should be gone
    await expect(page.locator('#comments-list')).not.toContainText(commentText);
  });

  test('shows error or prevents empty comment', async ({ page }) => {
    await addEmptyComment(page);
  });
});