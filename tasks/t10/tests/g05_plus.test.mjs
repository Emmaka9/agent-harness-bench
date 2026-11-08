import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../src/regex.js';

test('plus requires at least one repetition and backtracks greedily', () => {
  assert.deepEqual(compile('a+').exec('aaa'), { index: 0, groups: ['aaa'] });
  assert.deepEqual(compile('a+').exec('a'), { index: 0, groups: ['a'] });
  assert.deepEqual(compile('a+').exec(''), null);
  assert.deepEqual(compile('a+').exec('b'), null);
  assert.deepEqual(compile('a+b').exec('aab'), { index: 0, groups: ['aab'] });
  assert.deepEqual(compile('a+b').exec('b'), null);
  assert.deepEqual(compile('a+a').exec('aaa'), { index: 0, groups: ['aaa'] });
  assert.deepEqual(compile('a+a').exec('a'), null);
  assert.deepEqual(compile('ab+c').exec('abc'), { index: 0, groups: ['abc'] });
  assert.deepEqual(compile('ab+c').exec('ac'), null);
});
