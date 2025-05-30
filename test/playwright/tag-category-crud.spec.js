// Playwright E2E tests for Tag and Category CRUD, error/retry, and accessibility
const { test, expect } = require('@playwright/test');

test.describe('Tag & Category Management UI', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => {
      console.log(`[BROWSER][${msg.type()}]`, msg.text());
    });
    await page.goto('/');
    await page.waitForFunction(() => window.app !== undefined);
  });

  test('can add, edit, and delete a tag', async ({ page }) => {
    // Open tag manager modal
    await page.click('[data-testid="manage-tags-btn"]');
    await expect(page.locator('.modal.active')).toBeVisible();

    // Add tag
    const tagName = 'PlaywrightTag-' + Date.now();
    await page.fill('[data-testid="tag-name-input"]', tagName);
    await page.click('[data-testid="add-tag-btn"]');
    await expect(page.locator('.tag-pill', { hasText: tagName })).toBeVisible();

    // Edit tag
    await page.click(`.tag-pill:has-text("${tagName}") [data-testid="edit-tag-btn"]`);
    const newTagName = tagName + '-Edit';
    await page.fill('[data-testid="tag-name-input"]', newTagName);
    await page.click('[data-testid="save-tag-btn"]');
    await expect(page.locator('.tag-pill', { hasText: newTagName })).toBeVisible();

    // Delete tag
    await page.click(`.tag-pill:has-text("${newTagName}") [data-testid="delete-tag-btn"]`);
    await page.click('[data-testid="confirm-delete-btn"]');
    await expect(page.locator('.tag-pill', { hasText: newTagName })).not.toBeVisible();
  });

  test('can add, edit, and delete a category', async ({ page }) => {
    // Open category manager modal
    await page.click('[data-testid="manage-categories-btn"]');
    await expect(page.locator('.modal.active')).toBeVisible();

    // Add category
    const catName = 'PlaywrightCat-' + Date.now();
    await page.fill('[data-testid="category-name-input"]', catName);
    await page.click('[data-testid="add-category-btn"]');
    await expect(page.locator('.category-pill', { hasText: catName })).toBeVisible();

    // Edit category
    await page.click(`.category-pill:has-text("${catName}") [data-testid="edit-category-btn"]`);
    const newCatName = catName + '-Edit';
    await page.fill('[data-testid="category-name-input"]', newCatName);
    await page.click('[data-testid="save-category-btn"]');
    await expect(page.locator('.category-pill', { hasText: newCatName })).toBeVisible();

    // Delete category
    await page.click(`.category-pill:has-text("${newCatName}") [data-testid="delete-category-btn"]`);
    await page.click('[data-testid="confirm-delete-btn"]');
    await expect(page.locator('.category-pill', { hasText: newCatName })).not.toBeVisible();
  });

  test('shows error and allows retry on tag/category add failure', async ({ page }) => {
    // Simulate network error for tag add
    await page.click('[data-testid="manage-tags-btn"]');
    await page.route('/api/tags.php*', route => route.abort());
    await page.fill('[data-testid="tag-name-input"]', 'FailTag');
    await page.click('[data-testid="add-tag-btn"]');
    await expect(page.locator('.toast, [role="alert"]')).toBeVisible();
    await page.unroute('/api/tags.php*');
    // Retry should succeed
    await page.click('[data-testid="add-tag-btn"]');
    await expect(page.locator('.tag-pill', { hasText: 'FailTag' })).toBeVisible();

    // Simulate network error for category add
    await page.click('[data-testid="manage-categories-btn"]');
    await page.route('/api/categories.php*', route => route.abort());
    await page.fill('[data-testid="category-name-input"]', 'FailCat');
    await page.click('[data-testid="add-category-btn"]');
    await expect(page.locator('.toast, [role="alert"]')).toBeVisible();
    await page.unroute('/api/categories.php*');
    // Retry should succeed
    await page.click('[data-testid="add-category-btn"]');
    await expect(page.locator('.category-pill', { hasText: 'FailCat' })).toBeVisible();
  });

  test('tag/category modals are accessible (ARIA, keyboard navigation)', async ({ page }) => {
    // Open tag manager modal
    await page.click('[data-testid="manage-tags-btn"]');
    const modal = page.locator('.modal.active');
    await expect(modal).toBeVisible();
    await expect(modal).toHaveAttribute('role', /dialog|alertdialog/);
    await expect(modal.locator('[data-testid="tag-name-input"]')).toHaveAttribute('aria-label', /tag/i);

    // Tab to close button and press Enter
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(modal).not.toBeVisible();

    // Open category manager modal
    await page.click('[data-testid="manage-categories-btn"]');
    const catModal = page.locator('.modal.active');
    await expect(catModal).toBeVisible();
    await expect(catModal).toHaveAttribute('role', /dialog|alertdialog/);
    await expect(catModal.locator('[data-testid="category-name-input"]')).toHaveAttribute('aria-label', /categor/i);

    // Escape closes modal
    await page.keyboard.press('Escape');
    await expect(catModal).not.toBeVisible();
  });
});