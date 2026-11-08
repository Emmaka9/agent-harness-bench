import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../src/regex.js';

test('groups capture text and number by opening parens, inner after outer', () => {
  assert.deepEqual(compile('(a)(b)(c)').exec('abc'), { index: 0, groups: ['abc', 'a', 'b', 'c'] });
  assert.deepEqual(compile('(a)').exec('a'), { index: 0, groups: ['a', 'a'] });
  assert.deepEqual(compile('(ab)').exec('xabcy'), { index: 1, groups: ['ab', 'ab'] });
  assert.deepEqual(compile('(a(b)c)').exec('abc'), { index: 0, groups: ['abc', 'abc', 'b'] });
  assert.deepEqual(compile('(a(b(c)))').exec('abc'), { index: 0, groups: ['abc', 'abc', 'bc', 'c'] });
  assert.deepEqual(compile('((a)(b))').exec('ab'), { index: 0, groups: ['ab', 'ab', 'a', 'b'] });
  assert.deepEqual(compile('(a)(b)(c)(d)(e)(f)(g)(h)(i)(j)(k)').exec('abcdefghijk'), {
    index: 0,
    groups: ['abcdefghijk', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k'],
  });
});
