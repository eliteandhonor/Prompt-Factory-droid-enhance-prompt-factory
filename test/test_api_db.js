import * as dbApi from '../js/api/db.js';

QUnit.module('api/db.js', hooks => {
  QUnit.test('Exports basic API functions and allows loading state', assert => {
    assert.equal(typeof dbApi.getCurrentUserId, 'function', 'getCurrentUserId export');
    assert.equal(typeof dbApi.listPrompts, 'function', 'listPrompts export');
    assert.equal(typeof dbApi.createPrompt, 'function', 'createPrompt export');
    assert.equal(typeof dbApi.listCategories, 'function', 'listCategories export');
    assert.equal(typeof dbApi.listTags, 'function', 'listTags export');
    // Smoke: calling listPrompts returns a Promise
    const p = dbApi.listPrompts();
    assert.ok(p && typeof p.then === 'function', 'listPrompts returns a Promise');
  });
  // Note: deeper tests require full backend or browser mock; future stubs can extend this.
});