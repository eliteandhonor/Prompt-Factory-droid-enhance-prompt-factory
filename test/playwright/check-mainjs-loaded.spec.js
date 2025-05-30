import { test, expect } from '@playwright/test';

test('window.__mainJsLoaded and window.app are available after app init', async ({ page }) => {
  // Listen for all console events
  page.on('console', msg => {
    console.log(`[browser console] ${msg.type()}: ${msg.text()}`);
  });
  // Listen for page errors
  page.on('pageerror', error => {
    console.log(`[browser pageerror] ${error.message}`);
  });
  // Listen for all responses and log Content-Type for main.js
  page.on('response', response => {
    if (response.url().includes('/js/main.js')) {
      const headers = response.headers();
      console.log(`[response] ${response.url()} Content-Type: ${headers['content-type']}`);
    }
  });

  await page.goto('http://localhost:8000/');
  // Dump full HTML content for diagnostics
  const html = await page.content();
  console.log('DIAGNOSTIC: page.content (first 3000 chars):\n', html.slice(0, 3000));

  // Wait for main.js to set the global
  try {
    await page.waitForFunction(() => window.__mainJsLoaded === true, null, { timeout: 5000 });
    await page.waitForFunction(() => typeof window.app === 'object', null, { timeout: 5000 });
  } catch (e) {
    console.log('DIAGNOSTIC: waitForFunction failed:', e);
  }

  // Diagnostics
  const mainJsLoaded = await page.evaluate(() => window.__mainJsLoaded);
  const appType = await page.evaluate(() => typeof window.app);
  console.log('window.__mainJsLoaded:', mainJsLoaded);
  console.log('window.app type:', appType);
  expect(mainJsLoaded).toBe(true);
  expect(appType).toBe('object');
});