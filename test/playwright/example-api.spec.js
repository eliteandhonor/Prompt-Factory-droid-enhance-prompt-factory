// Example API contract test using Playwright API testing capabilities with backend PHP endpoint

const { test, expect, request } = require('@playwright/test');

test('db.local.health.php endpoint returns 200 and valid response', async ({ request }) => {
  // Use Playwright's request fixture, which uses baseURL from config
  const response = await request.get('/db.local.health.php?action=health');
  expect(response.status()).toBe(200);

  // Check response JSON structure for health contract
  const body = await response.json();
  expect(body).toHaveProperty('ok', true);
  expect(body).toHaveProperty('msg');
  expect(body).toHaveProperty('php');
  expect(body).toHaveProperty('time');
});