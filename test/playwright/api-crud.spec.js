// Playwright API contract tests for all main endpoints: categories, tags, prompts, results, comments (CRUD + error cases)
const { test, expect, request } = require('@playwright/test');

const endpoints = [
  { name: 'categories', url: '/api/categories.php' },
  { name: 'tags', url: '/api/tags.php' },
  { name: 'prompts', url: '/api/prompts.php' },
  { name: 'results', url: '/api/results.php' },
  { name: 'comments', url: '/api/comments.php' }
];

for (const { name, url } of endpoints) {
  test.describe(`${name} API CRUD`, () => {
    let createdId = null;

    test(`POST creates a new ${name.slice(0, -1)}`, async ({ request }) => {
      const data = name === 'results'
        ? { prompt_id: 1, value: 'Test result' }
        : name === 'comments'
        ? { prompt_id: 1, text: 'Test comment' }
        : { name: `Test ${name.slice(0, -1)}` };
      const response = await request.post(url, { data });
      expect([200, 201]).toContain(response.status());
      const body = await response.json();
      expect(body).toHaveProperty('id');
      createdId = body.id;
    });

    test(`GET returns list of ${name}`, async ({ request }) => {
      const response = await request.get(url);
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(Array.isArray(body)).toBe(true);
    });

    test(`GET returns single ${name.slice(0, -1)} by id`, async ({ request }) => {
      test.skip(!createdId, 'No id created');
      const response = await request.get(`${url}?id=${createdId}`);
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('id', createdId);
    });

    test(`PUT updates a ${name.slice(0, -1)}`, async ({ request }) => {
      test.skip(!createdId, 'No id created');
      const updateData = name === 'results'
        ? { id: createdId, value: 'Updated result' }
        : name === 'comments'
        ? { id: createdId, text: 'Updated comment' }
        : { id: createdId, name: `Updated ${name.slice(0, -1)}` };
      const response = await request.put(url, { data: updateData });
      expect([200, 204]).toContain(response.status());
    });

    test(`DELETE removes a ${name.slice(0, -1)}`, async ({ request }) => {
      test.skip(!createdId, 'No id created');
      const response = await request.delete(`${url}?id=${createdId}`);
      expect([200, 204]).toContain(response.status());
    });

    // Error cases
    test(`POST with missing/invalid data returns error`, async ({ request }) => {
      const response = await request.post(url, { data: {} });
      expect([400, 422, 500]).toContain(response.status());
    });

    test(`GET with invalid id returns error`, async ({ request }) => {
      const response = await request.get(`${url}?id=invalid`);
      expect([400, 404, 422, 500]).toContain(response.status());
    });

    test(`PUT with invalid id returns error`, async ({ request }) => {
      const updateData = name === 'results'
        ? { id: 999999, value: 'fail' }
        : name === 'comments'
        ? { id: 999999, text: 'fail' }
        : { id: 999999, name: 'fail' };
      const response = await request.put(url, { data: updateData });
      expect([400, 404, 422, 500]).toContain(response.status());
    });

    test(`DELETE with invalid id returns error`, async ({ request }) => {
      const response = await request.delete(`${url}?id=999999`);
      expect([400, 404, 422, 500]).toContain(response.status());
    });
  });
}