// @ts-check
const { defineConfig } = require('@playwright/test');

/**
 * Playwright Test Configuration
 * - baseURL points to the PHP dev server serving public_html at http://localhost:8000
 * - Tests should target http://localhost:8000/index.html (or relevant routes)
 * - Ensure index.html loads js/main.js for app functionality
 */
module.exports = defineConfig({
  testDir: __dirname,
  use: {
    baseURL: 'http://localhost:8000',
    // Additional options can be set here
    // e.g., headless: false, viewport: { width: 1280, height: 720 }
  },
  // Optionally, you can specify webServer if you want Playwright to start/stop the server automatically
  // webServer: {
  //   command: 'php -S localhost:8000 -t public_html',
  //   port: 8000,
  //   reuseExistingServer: true,
  // },
});
