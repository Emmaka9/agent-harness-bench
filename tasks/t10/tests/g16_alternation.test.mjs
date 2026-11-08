import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../src/regex.js';

test('alternation tries alternatives left to right and empty alternatives are allowed', () => {
  assert.deepEqual(compile('a|b').exec('b'), { index: 0, groups: ['b'] });
  assert.deepEqual(compile('a|b').exec('c'), null);
  assert.deepEqual(compile('a|b').exec('ba'), { index: 0, groups: ['b'] });
  assert.deepEqual(compile('cat|dog').exec('hotdog'), { index: 3, groups: ['dog'] });
  assert.deepEqual(compile('a|b|c').exec('c'), { index: 0, groups: ['c'] });
  assert.deepEqual(compile('(a|b)c').exec('bc'), { index: 0, groups: ['bc', 'b'] });
  assert.deepEqual(compile('(a|b)c').exec('ac'), { index: 0, groups: ['ac', 'a'] });
  assert.deepEqual(compile('(|a)').exec('a'), { index: 0, groups: ['', ''] });
  assert.deepEqual(compile('(a|)').exec('a'), { index: 0, groups: ['a', 'a'] });
  assert.deepEqual(compile('a||b').exec('b'), { index: 0, groups: [''] });
  assert.deepEqual(compile('a||b').exec('c'), { index: 0, groups: [''] });
  assert.deepEqual(compile('|a').exec('a'), { index: 0, groups: [''] });
  assert.equal(compile('a|').test('b'), true);
});
