import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../src/regex.js';

test('a dash is a literal at the start or end of a class, and escapes work inside classes', () => {
  assert.deepEqual(compile('[-a]').exec('-'), { index: 0, groups: ['-'] });
  assert.deepEqual(compile('[a-]').exec('-'), { index: 0, groups: ['-'] });
  assert.deepEqual(compile('[a-]').exec('a'), { index: 0, groups: ['a'] });
  assert.deepEqual(compile('[a\\-z]').exec('-'), { index: 0, groups: ['-'] });
  assert.deepEqual(compile('[a\\-z]').exec('b'), null);
  assert.deepEqual(compile('[\\]]').exec(']'), { index: 0, groups: [']'] });
  assert.deepEqual(compile('[\\]]').exec('a'), null);
  assert.deepEqual(compile('[a^]').exec('^'), { index: 0, groups: ['^'] });
  assert.deepEqual(compile('[a^]').exec('a'), { index: 0, groups: ['a'] });
  assert.deepEqual(compile('[a^]').exec('b'), null);
});
