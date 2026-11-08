import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../src/regex.js';

test('compile returns test and exec, and exec reports the leftmost match', () => {
  const c = compile('ab');
  assert.equal(typeof c.test, 'function');
  assert.equal(typeof c.exec, 'function');
  assert.equal(c.test('abc'), true);
  assert.equal(c.test('acb'), false);
  assert.equal(c.test(''), false);
  assert.deepEqual(c.exec('abc'), { index: 0, groups: ['ab'] });
  assert.equal(c.exec('acb'), null);
  assert.deepEqual(compile('').exec('anything'), { index: 0, groups: [''] });
  assert.deepEqual(compile('a+').exec('b'), null);
  assert.deepEqual(compile('b').exec('abbc'), { index: 1, groups: ['b'] });
  assert.deepEqual(compile('issip').exec('mississippi'), { index: 4, groups: ['issip'] });
  assert.deepEqual(compile('a').exec('xxazz'), { index: 2, groups: ['a'] });
  assert.deepEqual(compile('xyz').exec('xy'), null);
  assert.deepEqual(compile('cd').exec('abcde'), { index: 2, groups: ['cd'] });
});
