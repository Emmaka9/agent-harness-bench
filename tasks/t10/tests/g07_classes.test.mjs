import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../src/regex.js';

test('character classes match listed characters and inclusive ranges', () => {
  assert.deepEqual(compile('[abc]').exec('b'), { index: 0, groups: ['b'] });
  assert.deepEqual(compile('[abc]').exec('d'), null);
  assert.deepEqual(compile('[abc]').exec(''), null);
  assert.deepEqual(compile('[a-z]+').exec('ab12cd'), { index: 0, groups: ['ab'] });
  assert.deepEqual(compile('[a-cx-z]').exec('y'), { index: 0, groups: ['y'] });
  assert.deepEqual(compile('[a-cx-z]').exec('d'), null);
  assert.deepEqual(compile('[0-9]+').exec('abc123def'), { index: 3, groups: ['123'] });
  assert.deepEqual(compile('x[a-z]y').exec('xay'), { index: 0, groups: ['xay'] });
  assert.deepEqual(compile('x[a-z]y').exec('xAy'), null);
  assert.deepEqual(compile('x[a-z]y').exec('xy'), null);
  assert.deepEqual(compile('x[a-z]y').exec('xaay'), null);
});
