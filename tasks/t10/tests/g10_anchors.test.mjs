import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../src/regex.js';

test('anchors ^ and $ pin the match to the whole subject and are zero-width', () => {
  assert.deepEqual(compile('^abc').exec('abcdef'), { index: 0, groups: ['abc'] });
  assert.deepEqual(compile('^abc').exec('xabc'), null);
  assert.deepEqual(compile('abc$').exec('xabc'), { index: 1, groups: ['abc'] });
  assert.deepEqual(compile('abc$').exec('abcx'), null);
  assert.deepEqual(compile('^abc$').exec('abc'), { index: 0, groups: ['abc'] });
  assert.deepEqual(compile('^abc$').exec('abcd'), null);
  assert.deepEqual(compile('^abc$').exec('xabc'), null);
  assert.deepEqual(compile('^$').exec(''), { index: 0, groups: [''] });
  assert.deepEqual(compile('^$').exec('x'), null);
  assert.equal(compile('a^b').test('ab'), false);
  assert.equal(compile('a$b').test('ab'), false);
  assert.deepEqual(compile('^a*$').exec('aaa'), { index: 0, groups: ['aaa'] });
  assert.deepEqual(compile('^a*$').exec('aab'), null);
  assert.deepEqual(compile('^').exec('abc'), { index: 0, groups: [''] });
  assert.deepEqual(compile('$').exec('abc'), { index: 3, groups: [''] });
  assert.deepEqual(compile('^').exec(''), { index: 0, groups: [''] });
  assert.deepEqual(compile('$').exec(''), { index: 0, groups: [''] });
});
