import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchCount } from '../src/regex.js';

test('matchCount counts non-overlapping matches, resuming at each match end', () => {
  assert.equal(matchCount('aa', 'aaaa'), 2);
  assert.equal(matchCount('aa', 'aaa'), 1);
  assert.equal(matchCount('aa', 'aaaaa'), 2);
  assert.equal(matchCount('a', 'aaa'), 3);
  assert.equal(matchCount('ab', 'abab'), 2);
  assert.equal(matchCount('abab', 'ababab'), 1);
  assert.equal(matchCount('aba', 'ababab'), 1);
  assert.equal(matchCount('aa', 'a'), 0);
  assert.equal(matchCount('aa', ''), 0);
  assert.equal(matchCount('abc', 'ab'), 0);
  assert.equal(matchCount('[a-z]+', 'ab12cd'), 2);
  assert.equal(matchCount('[0-9]+', 'a1b22c333'), 3);
  assert.equal(matchCount('[^ ]+', 'a b c'), 3);
  assert.equal(matchCount('[a-z]*', 'ab12cd'), 5);
});
