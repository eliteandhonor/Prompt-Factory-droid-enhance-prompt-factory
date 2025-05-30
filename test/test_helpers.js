import { uuidv4, formatDate, truncateText } from '../js/util/helpers.js';

QUnit.module('helpers.js', hooks => {
  QUnit.test('uuidv4 returns a valid UUID v4 and is unique', assert => {
    const uuid1 = uuidv4();
    const uuid2 = uuidv4();
    assert.ok(typeof uuid1 === 'string' && uuid1.length >= 32, 'Produces a string');
    assert.notEqual(uuid1, uuid2, 'UUIDs should be unique');
    assert.ok(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(uuid1), 'Valid UUID v4 format');
  });

  QUnit.test('formatDate handles ISO string, Date object, and fallback', assert => {
    assert.equal(formatDate('2025-05-03T12:30:00Z'), '2025 May 03', 'Formats ISO date');
    assert.equal(formatDate(new Date('2024-01-13')), '2024 Jan 13', 'Formats Date object');
    assert.equal(formatDate('not-a-date'), 'not-a-date', 'Falls back to string for invalid date');
    assert.equal(formatDate(''), '', 'Empty string yields empty');
  });

  QUnit.test('truncateText shortens only when needed with "..."', assert => {
    assert.equal(truncateText('hello world', 5), 'he...', 'Truncate to shorter');
    assert.equal(truncateText('hi', 5), 'hi', 'Does not truncate short string');
    assert.equal(truncateText('a', 1), '', 'Returns empty for very small n');
    assert.equal(truncateText('', 5), '', 'Empty input yields empty');
    assert.equal(truncateText(null, 10), '', 'Null input yields empty');
    assert.equal(truncateText('test', 4), 'test', 'Edge: n==length, no truncation');
    assert.equal(truncateText('abcde', 5), 'abcde', 'n equals string length');
    assert.equal(truncateText('abcdef', 5), 'ab...', 'n less than string length');
  });
});