// Playwright E2E test for Prompt CRUD (Create, Read, Update, Delete)
// Refactored for clarity, maintainability, and modularity.

const { test, expect } = require('@playwright/test');

/**
 * Navigates to the Prompts section of the app.
 * @param {import('@playwright/test').Page} page
 */
async function gotoPromptsSection(page) {
  await page.goto('/');
  await page.waitForFunction(() => window.app !== undefined);
  await page.click('#nav-prompts-btn');
  await expect(page.locator('[data-testid="prompt-list"]')).toBeVisible();
  // Clear any search/filter input if present
  const searchInput = await page.$('[data-testid="prompt-search-input"]');
  if (searchInput) {
    await searchInput.fill('');
    await searchInput.blur();
  }
}

/**
 * Creates a new prompt and returns its data-id.
 * @param {import('@playwright/test').Page} page
 * @param {string} title
 * @param {string} content
 * @returns {Promise<string>} The data-id of the created prompt.
 */
async function createPrompt(page, title, content) {
  await page.click('[data-testid="add-prompt-btn"]');
  await expect(page.locator('[data-testid="prompt-title-input"]')).toBeVisible();
  await page.fill('[data-testid="prompt-title-input"]', title);
  await page.fill('[data-testid="prompt-content-input"]', content);

  // Attach a listener for promptListReady BEFORE submitting the form
  await page.evaluate(() => {
    window.__promptListReadyPromise = new Promise(resolve => {
      window.addEventListener('promptListReady', () => resolve(), { once: true });
    });
  });

  await page.click('[data-testid="save-prompt-btn"]');

  // Wait for the promptListReady event to fire
  await page.evaluate(() => window.__promptListReadyPromise);

  // Wait for either the prompt block or the prompt title to appear
  const promptBlockLocator = page.locator('[data-testid="prompt-block"]', { hasText: title }).first();
  const promptTitleLocator = page.locator('[data-testid="prompt-title"]', { hasText: title }).first();
  await expect(promptBlockLocator).toBeVisible({ timeout: 10000 });
  await expect(promptTitleLocator).toBeVisible({ timeout: 10000 });
  // Diagnostic: log all prompt titles in the DOM after creation
  const allTitles = await page.$$eval('[data-testid="prompt-title"]', els => els.map(el => el.textContent));
  console.log("DIAGNOSTIC: Prompt titles in DOM after creation:", allTitles);
  return await promptTitleLocator.getAttribute('data-id');
}

/**
 * Waits for the custom 'promptListReady' event on the page.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<void>}
 */
/* waitForPromptListReady removed: now handled within createPrompt */

/**
 * Reads (views) a prompt by its data-id and asserts its title/content.
 * @param {import('@playwright/test').Page} page
 * @param {string} promptId
 * @param {string} expectedTitle
 * @param {string} expectedContent
 */
async function readPrompt(page, promptId, expectedTitle, expectedContent) {
  const selector = `[data-testid="prompt-title"][data-id="${promptId}"]`;
  await page.locator(selector).scrollIntoViewIfNeeded();
  await page.waitForTimeout(100); // ensure in view
  await page.click(selector);
  await expect(page.locator('[data-testid="prompt-detail-title"]')).toHaveText(expectedTitle);
  await expect(page.locator('[data-testid="prompt-detail-content"]')).toHaveText(expectedContent);
}

/**
 * Updates a prompt's title by its data-id.
 * @param {import('@playwright/test').Page} page
 * @param {string} newTitle
 * @param {string} promptId
 */
async function updatePrompt(page, newTitle, promptId) {
  await page.click('[data-testid="edit-prompt-btn"]');
  await page.fill('[data-testid="prompt-title-input"]', newTitle);
  await page.click('[data-testid="save-prompt-btn"]');
  const updatedTitleLocator = page.locator('[data-testid="prompt-title"]', { hasText: newTitle }).and(page.locator(`[data-id="${promptId}"]`));
  await expect(updatedTitleLocator).toBeVisible();
}

/**
 * Deletes a prompt by its data-id.
 * @param {import('@playwright/test').Page} page
 * @param {string} promptId
 * @param {string} promptTitle
 */
async function deletePrompt(page, promptId, promptTitle) {
  await page.click('[data-testid="delete-prompt-btn"]');
  await page.click('[data-testid="confirm-delete-btn"]');
  const deletedPromptLocator = page.locator('[data-testid="prompt-title"]', { hasText: promptTitle }).and(page.locator(`[data-id="${promptId}"]`));
  await expect(deletedPromptLocator).not.toBeVisible();
}

test.describe('Prompt CRUD', () => {
  test.beforeEach(async ({ page }) => {
    // Capture and print all browser console logs for maximum debug output
    page.on('console', msg => {
      console.log(`[BROWSER][${msg.type()}]`, msg.text());
    });
  });

  test('can create, read, update, and delete a prompt', async ({ page }) => {
    try {
      // Step 1: Go to Prompts section
      await gotoPromptsSection(page);

      // Step 2: CREATE a new prompt
      const initialTitle = 'Test Prompt';
      const initialContent = 'This is a test prompt.';
      const promptId = await createPrompt(page, initialTitle, initialContent);

      // Step 3: READ the created prompt
      await readPrompt(page, promptId, initialTitle, initialContent);

      // Step 4: UPDATE the prompt's title
      const updatedTitle = 'Test Prompt Updated';
      await updatePrompt(page, updatedTitle, promptId);

      // Step 5: DELETE the prompt
      await deletePrompt(page, promptId, updatedTitle);

    } catch (err) {
      // Diagnostic: print error and check if page is closed before evaluating
      console.log("DIAGNOSTIC: Caught error in CRUD test:", err && err.message);
      let isClosed = false;
      try {
        await page.title();
      } catch (e) {
        isClosed = true;
        console.log("DIAGNOSTIC: Page is already closed, skipping page.evaluate diagnostics.");
      }
      if (!isClosed) {
        try {
          const diag = await page.evaluate(() => ({
            modalsInit: window.__modalsInit,
            crudModalEventReceived: window.__crudModalEventReceived,
            promptTitleInputPresent: window.__promptTitleInputPresent
          }));
          console.log("DIAGNOSTIC GLOBALS:", diag);
        } catch (evalErr) {
          console.log("DIAGNOSTIC: page.evaluate failed:", evalErr && evalErr.message);
        }
      }
      throw err;
    }
  });
});