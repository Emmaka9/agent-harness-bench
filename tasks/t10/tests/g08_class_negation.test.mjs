import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../src/regex.js';

test('negated classes match anything not listed, including newline', () => {
  assert.deepEqual(compile('[^a-z]').exec('a'), null);
  assert.deepEqual(compile('[^a-z]').exec('A'), { index: 0, groups: ['A'] });
  assert.deepEqual(compile('[^a-z]+').exec('abcABC'), { index: 3, groups: ['ABC'] });
  assert.deepEqual(compile('[^a]').exec('\n'), { index: 0, groups: ['\n'] });
  assert.deepEqual(compile('[^a-z][^a-z]').exec('ABab'), { index: 0, groups: ['AB'] });
  assert.deepEqual(compile('[^x]').exec('xxa'), { index: 2, groups: ['a'] });
  assert.deepEqual(compile('[^x]').exec('x'), null);
  assert.deepEqual(compile('[^0-9]+').exec('12ab34'), { index: 2, groups: ['ab'] });
  assert.deepEqual(compile('[^ab]*a').exec('cdab'), { index: 0, groups: ['cda'] });
  assert.deepEqual(compile('[^ab][^ab]').exec('cdab'), { index: 0, groups: ['cd'] });
});
