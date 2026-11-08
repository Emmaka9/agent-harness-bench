import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../src/regex.js';

test('star is greedy and takes everything it can', () => {
  assert.deepEqual(compile('a*').exec('aaa'), { index: 0, groups: ['aaa'] });
  assert.deepEqual(compile('a*').exec('baaab'), { index: 0, groups: [''] });
  assert.deepEqual(compile('xa*').exec('bxaaz'), { index: 1, groups: ['xaa'] });
  assert.deepEqual(compile('a*').exec(''), { index: 0, groups: [''] });
  assert.deepEqual(compile('a*').exec('b'), { index: 0, groups: [''] });
  assert.deepEqual(compile('ab*c').exec('abbbc'), { index: 0, groups: ['abbbc'] });
  assert.deepEqual(compile('ab*c').exec('ac'), { index: 0, groups: ['ac'] });
  assert.deepEqual(compile('<.*>').exec('<a><b>'), { index: 0, groups: ['<a><b>'] });
  assert.deepEqual(compile('<.*>').exec('no tags'), null);
});
