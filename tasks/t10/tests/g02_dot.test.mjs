import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../src/regex.js';

test('dot matches any single character except newline', () => {
  const c = compile('a.c');
  assert.deepEqual(c.exec('abc'), { index: 0, groups: ['abc'] });
  assert.deepEqual(c.exec('axc'), { index: 0, groups: ['axc'] });
  assert.deepEqual(c.exec('a\nc'), null);
  assert.equal(c.test('abc'), true);
  assert.equal(c.test('a\nc'), false);
  assert.equal(compile('.').test('\n'), false);
  assert.deepEqual(compile('.').exec('x'), { index: 0, groups: ['x'] });
  assert.deepEqual(compile('.').exec('\nx'), { index: 1, groups: ['x'] });
  assert.deepEqual(compile('.').exec('\n\nx'), { index: 2, groups: ['x'] });
  assert.equal(compile('.').exec(''), null);
  assert.deepEqual(compile('...').exec('abcd'), { index: 0, groups: ['abc'] });
  assert.deepEqual(compile('...').exec('ab'), null);
  assert.deepEqual(compile('a.').exec('a\nb'), null);
});
