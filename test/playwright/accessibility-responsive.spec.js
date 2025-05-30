// Playwright E2E tests for accessibility (ARIA, keyboard navigation) and mobile/responsive UI
const { test, expect, devices } = require('@playwright/test');

test.describe('Accessibility & Responsive UI', () => {
  test('main workflows are keyboard accessible and have ARIA roles', async ({ page }) => {
    await page.goto('/');
    // Tab to first prompt, open with Enter
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(page.locator('.modal.active')).toBeVisible();
    await expect(page.locator('.modal.active')).toHaveAttribute('role', /dialog|alertdialog/);

    // Tab to close button and close with Enter
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(page.locator('.modal.active')).not.toBeVisible();

    // Open add prompt modal and check ARIA
    await page.click('[data-testid="add-prompt-btn"]');
    const modal = page.locator('.modal.active');
    await expect(modal).toBeVisible();
    await expect(modal).toHaveAttribute('role', /dialog|alertdialog/);
    await expect(modal.locator('[data-testid="prompt-title-input"]')).toHaveAttribute('aria-label', /title/i);
    await expect(modal.locator('[data-testid="prompt-content-input"]')).toHaveAttribute('aria-label', /content/i);
    // Escape closes modal
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
  });

  for (const device of [devices['iPhone 12'], devices['Pixel 5'], devices['iPad Mini']]) {
    test.use({ ...device });
    test(`UI is responsive on ${device.name}`, async ({ page }) => {
      await page.goto('/');
      // Main navigation and prompt list should be visible and usable
      await expect(page.locator('#nav-prompts-btn')).toBeVisible();
      await expect(page.locator('[data-testid="prompt-list"]')).toBeVisible();
      // Open a prompt and check modal layout
      await page.click('[data-testid="prompt-title"]');
      await expect(page.locator('.modal.active')).toBeVisible();
      // Modal should not overflow viewport
      const modalBox = await page.locator('.modal.active').boundingBox();
      expect(modalBox.width).toBeLessThanOrEqual(page.viewportSize().width);
      expect(modalBox.height).toBeLessThanOrEqual(page.viewportSize().height);
    });
  }
});