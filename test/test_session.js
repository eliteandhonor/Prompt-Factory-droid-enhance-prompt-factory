import { getCurrentUserId, canEdit, isAdmin } from '../js/auth/session.js';

QUnit.module('session.js', hooks => {
  QUnit.test('getCurrentUserId always returns anon', assert => {
    assert.equal(getCurrentUserId(), 'anon', 'Returns anon by default');
  });

  QUnit.test('isAdmin always returns false', assert => {
    assert.equal(isAdmin(), false, 'isAdmin is false on stub');
  });

  QUnit.test('canEdit always returns true for any entity', assert => {
    assert.ok(canEdit({user_id: 'any'}), 'Returns true (stub)');
    assert.ok(canEdit({}), 'Returns true even for empty object');
    assert.ok(canEdit(null), 'Returns true for null (stub does not error)');
  });
});