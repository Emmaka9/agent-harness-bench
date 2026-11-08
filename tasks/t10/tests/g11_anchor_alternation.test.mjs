import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../src/regex.js';

test('alternation combined with anchors resolves per the backtracking order', () => {
  assert.deepEqual(compile('^a|b$').exec('ab'), { index: 0, groups: ['a'] });
  assert.deepEqual(compile('^a|b$').exec('ba'), null);
  assert.deepEqual(compile('^a|b$').exec('a'), { index: 0, groups: ['a'] });
  assert.deepEqual(compile('^a|b$').exec('b'), { index: 0, groups: ['b'] });
  assert.deepEqual(compile('a$|^x').exec('xba'), { index: 0, groups: ['x'] });
  assert.deepEqual(compile('^a$').exec('a'), { index: 0, groups: ['a'] });
  assert.deepEqual(compile('^a$').exec('ab'), null);
  assert.deepEqual(compile('^a$').exec('ba'), null);
});
