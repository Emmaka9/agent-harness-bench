import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../src/regex.js';

test('a*a backtracks: the star gives characters back until the final a matches', () => {
  assert.deepEqual(compile('a*a').exec('aaa'), { index: 0, groups: ['aaa'] });
  assert.deepEqual(compile('a*a').exec('aaab'), { index: 0, groups: ['aaa'] });
  assert.deepEqual(compile('a*a').exec('b'), null);
  assert.deepEqual(compile('a*a').exec('a'), { index: 0, groups: ['a'] });
  assert.deepEqual(compile('x*x').exec('x'), { index: 0, groups: ['x'] });
  assert.deepEqual(compile('a*a*b').exec('aaab'), { index: 0, groups: ['aaab'] });
  assert.deepEqual(compile('^x*x$').exec('xx'), { index: 0, groups: ['xx'] });
  assert.deepEqual(compile('a*a').exec('aa'), { index: 0, groups: ['aa'] });
});
