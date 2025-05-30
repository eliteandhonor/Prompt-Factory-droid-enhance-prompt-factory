// Playwright E2E tests for Batch Import Modal and API
// Covers: modal open, file upload, paste, validation, duplicates, accessibility, UI feedback, integration

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const VALID_PROMPTS = [
  { title: "Batch Prompt 1", content: "Content 1" },
  { title: "Batch Prompt 2", content: "Content 2" }
];
const DUPLICATE_PROMPT = { title: "Batch Prompt 1", content: "Content 1" };
const INVALID_JSON = "{ title: 'Missing quotes' }";
const PARTIAL_PROMPT = { title: "Incomplete" }; // missing content

/**
 * Navigates to the Prompts section of the app.
 * @param {import('@playwright/test').Page} page
 */
async function gotoPromptsSection(page) {
  await page.goto('/');
  await page.waitForFunction(() => window.app !== undefined);
  await page.click('#nav-prompts-btn');
  await expect(page.locator('[data-testid="prompt-list"]')).toBeVisible();
}

/**
 * Opens the batch import modal via the UI.
 * @param {import('@playwright/test').Page} page
 */
async function openBatchImportModal(page) {
  await gotoPromptsSection(page);
  await page.click('[data-testid="batch-import-btn"]');
  await expect(page.locator('[data-testid="batch-import-modal"]')).toBeVisible();
}

test.describe('Batch Import Modal & API', () => {
  test.beforeEach(async ({ page }) => {
    // Print browser console logs for diagnostics
    page.on('console', msg => {
      console.log(`[BROWSER][${msg.type()}]`, msg.text());
    });
    await gotoPromptsSection(page);
  });

  test('opens the batch import modal via the UI', async ({ page }) => {
    await page.click('[data-testid="batch-import-btn"]');
    await expect(page.locator('[data-testid="batch-import-modal"]')).toBeVisible();
    // Modal should have focus
    await expect(page.locator('[data-testid="batch-import-modal"]')).toBeFocused();
  });

  test('uploads a valid JSON file and verifies successful import', async ({ page }, testInfo) => {
    await openBatchImportModal(page);

    // Write valid prompts to a temp file
    const filePath = path.join(testInfo.outputDir, 'valid-prompts.json');
    fs.writeFileSync(filePath, JSON.stringify(VALID_PROMPTS, null, 2));

    // Upload file
    const fileInput = page.locator('[data-testid="batch-import-file-input"]');
    await fileInput.setInputFiles(filePath);

    // Confirm import
    await page.click('[data-testid="batch-import-confirm-btn"]');

    // Success toast/banner
    await expect(page.locator('[data-testid="toast-success"], [data-testid="banner-success"]')).toBeVisible();

    // Modal closes
    await expect(page.locator('[data-testid="batch-import-modal"]')).toBeHidden();

    // Prompt list refreshes and contains imported prompts
    for (const prompt of VALID_PROMPTS) {
      await expect(page.locator('[data-testid="prompt-title"]', { hasText: prompt.title })).toBeVisible();
    }
  });

  test('pastes valid JSON and verifies successful import', async ({ page }) => {
    await openBatchImportModal(page);

    // Paste JSON into textarea
    await page.fill('[data-testid="batch-import-textarea"]', JSON.stringify(VALID_PROMPTS));

    // Confirm import
    await page.click('[data-testid="batch-import-confirm-btn"]');

    // Success feedback
    await expect(page.locator('[data-testid="toast-success"], [data-testid="banner-success"]')).toBeVisible();

    // Modal closes
    await expect(page.locator('[data-testid="batch-import-modal"]')).toBeHidden();

    // Prompt list refreshes and contains imported prompts
    for (const prompt of VALID_PROMPTS) {
      await expect(page.locator('[data-testid="prompt-title"]', { hasText: prompt.title })).toBeVisible();
    }
  });

  test('shows error feedback for invalid JSON file upload', async ({ page }, testInfo) => {
    await openBatchImportModal(page);

    // Write invalid JSON to a temp file
    const filePath = path.join(testInfo.outputDir, 'invalid.json');
    fs.writeFileSync(filePath, INVALID_JSON);

    // Upload file
    const fileInput = page.locator('[data-testid="batch-import-file-input"]');
    await fileInput.setInputFiles(filePath);

    // Confirm import
    await page.click('[data-testid="batch-import-confirm-btn"]');

    // Error toast/banner
    await expect(page.locator('[data-testid="toast-error"], [data-testid="banner-error"]')).toBeVisible();

    // Modal remains open
    await expect(page.locator('[data-testid="batch-import-modal"]')).toBeVisible();
  });

  test('shows error feedback for invalid pasted JSON', async ({ page }) => {
    await openBatchImportModal(page);

    await page.fill('[data-testid="batch-import-textarea"]', INVALID_JSON);

    await page.click('[data-testid="batch-import-confirm-btn"]');

    await expect(page.locator('[data-testid="toast-error"], [data-testid="banner-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="batch-import-modal"]')).toBeVisible();
  });

  test('handles duplicates and reports skipped prompts', async ({ page }, testInfo) => {
    // First import a prompt
    await openBatchImportModal(page);
    const filePath = path.join(testInfo.outputDir, 'single-prompt.json');
    fs.writeFileSync(filePath, JSON.stringify([DUPLICATE_PROMPT], null, 2));
    await page.locator('[data-testid="batch-import-file-input"]').setInputFiles(filePath);
    await page.click('[data-testid="batch-import-confirm-btn"]');
    await expect(page.locator('[data-testid="toast-success"], [data-testid="banner-success"]')).toBeVisible();
    await expect(page.locator('[data-testid="batch-import-modal"]')).toBeHidden();

    // Now import again with duplicate and a new prompt
    await openBatchImportModal(page);
    const filePath2 = path.join(testInfo.outputDir, 'dupe-and-new.json');
    fs.writeFileSync(filePath2, JSON.stringify([DUPLICATE_PROMPT, { title: "Unique Prompt", content: "Unique Content" }], null, 2));
    await page.locator('[data-testid="batch-import-file-input"]').setInputFiles(filePath2);
    await page.click('[data-testid="batch-import-confirm-btn"]');

    // Should show feedback about skipped/duplicate
    const feedback = page.locator('[data-testid="toast-info"], [data-testid="banner-info"], [data-testid="toast-success"], [data-testid="banner-success"]');
    await expect(feedback).toBeVisible();
    await expect(feedback).toContainText(/skipped|duplicate/i);

    // Only the new prompt is added
    await expect(page.locator('[data-testid="prompt-title"]', { hasText: "Unique Prompt" })).toBeVisible();
  });

  test('shows validation errors for missing required fields', async ({ page }) => {
    await openBatchImportModal(page);

    // Paste partial prompt (missing content)
    await page.fill('[data-testid="batch-import-textarea"]', JSON.stringify([PARTIAL_PROMPT]));

    await page.click('[data-testid="batch-import-confirm-btn"]');

    await expect(page.locator('[data-testid="toast-error"], [data-testid="banner-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="batch-import-modal"]')).toBeVisible();
  });

  test('accessibility: keyboard navigation, ARIA roles, and focus management', async ({ page }) => {
    await openBatchImportModal(page);

    // Modal should have role dialog
    const modal = page.locator('[data-testid="batch-import-modal"]');
    await expect(modal).toHaveAttribute('role', /dialog|alertdialog/);

    // Focus is trapped in modal: Tab cycles through focusable elements
    const focusable = [
      '[data-testid="batch-import-file-input"]',
      '[data-testid="batch-import-textarea"]',
      '[data-testid="batch-import-confirm-btn"]',
      '[data-testid="batch-import-cancel-btn"]'
    ];
    for (const selector of focusable) {
      await page.keyboard.press('Tab');
      await expect(page.locator(selector)).toBeFocused();
    }
    // Shift+Tab cycles backwards
    for (const selector of focusable.slice().reverse()) {
      await page.keyboard.down('Shift');
      await page.keyboard.press('Tab');
      await page.keyboard.up('Shift');
      await expect(page.locator(selector)).toBeFocused();
    }

    // Escape closes modal
    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
  });

  test('UI feedback: success and error toasts/banners', async ({ page }, testInfo) => {
    await openBatchImportModal(page);

    // Success: valid JSON
    await page.fill('[data-testid="batch-import-textarea"]', JSON.stringify(VALID_PROMPTS));
    await page.click('[data-testid="batch-import-confirm-btn"]');
    await expect(page.locator('[data-testid="toast-success"], [data-testid="banner-success"]')).toBeVisible();

    // Error: invalid JSON
    await openBatchImportModal(page);
    await page.fill('[data-testid="batch-import-textarea"]', INVALID_JSON);
    await page.click('[data-testid="batch-import-confirm-btn"]');
    await expect(page.locator('[data-testid="toast-error"], [data-testid="banner-error"]')).toBeVisible();
  });

  test('integration: prompt list refreshes after import', async ({ page }, testInfo) => {
    await openBatchImportModal(page);

    // Import a new prompt
    const newPrompt = { title: "Integration Test Prompt", content: "Integration Content" };
    await page.fill('[data-testid="batch-import-textarea"]', JSON.stringify([newPrompt]));
    await page.click('[data-testid="batch-import-confirm-btn"]');
    await expect(page.locator('[data-testid="toast-success"], [data-testid="banner-success"]')).toBeVisible();

    // Prompt list should show the new prompt
    await expect(page.locator('[data-testid="prompt-title"]', { hasText: newPrompt.title })).toBeVisible();
  });
});