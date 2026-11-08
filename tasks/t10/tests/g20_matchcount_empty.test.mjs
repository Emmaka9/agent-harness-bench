import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchCount } from '../src/regex.js';

test('matchCount advances one character past an empty match instead of looping', () => {
  assert.equal(matchCount('', 'abc'), 4);
  assert.equal(matchCount('', ''), 1);
  assert.equal(matchCount('x*', 'yyy'), 4);
  assert.equal(matchCount('x+', 'yyy'), 0);
  assert.equal(matchCount('x?', 'yyy'), 4);
  assert.equal(matchCount('a*', 'baaab'), 4);
  assert.equal(matchCount('a?', 'aaa'), 4);
  assert.equal(matchCount('^$', ''), 1);
  assert.equal(matchCount('^$', 'x'), 0);
  assert.equal(matchCount('^a', 'aab'), 1);
  assert.equal(matchCount('^a*', 'aab'), 1);
  assert.equal(matchCount('a*$', 'aab'), 1);
  assert.equal(matchCount('^a$', 'aa'), 0);
  assert.equal(matchCount('^', 'abc'), 1);
  assert.equal(matchCount('$', 'abc'), 1);
  assert.equal(matchCount('(a|b)*c', 'ababcababd'), 1);
  assert.equal(matchCount('\\*', '**'), 2);
  assert.equal(matchCount('a*a', 'aaa'), 1);
});
