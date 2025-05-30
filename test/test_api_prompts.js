import * as promptsApi from '../js/api/prompts.js';

QUnit.module('api/prompts.js', hooks => {
  QUnit.test('Prompts API provides expected exports and base behavior', assert => {
    assert.equal(typeof promptsApi.listPrompts, 'function', 'listPrompts export');
    assert.equal(typeof promptsApi.createPrompt, 'function', 'createPrompt export');
    assert.equal(typeof promptsApi.listCategories, 'function', 'listCategories export');
    assert.equal(typeof promptsApi.listTags, 'function', 'listTags export');
    assert.equal(typeof promptsApi.editPromptComment, 'function', 'editPromptComment export');
    assert.equal(typeof promptsApi.devTestHook, 'function', 'devTestHook export');
    // Smoke: listPrompts returns a Promise
    const p = promptsApi.listPrompts();
    assert.ok(p && typeof p.then === 'function', 'listPrompts returns a Promise');
  });
  // More tests can be added with mock backends.
});