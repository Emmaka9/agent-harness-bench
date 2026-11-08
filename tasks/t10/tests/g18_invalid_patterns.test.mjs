import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compile, matchCount } from '../src/regex.js';

test('invalid patterns throw TypeError with the exact prefixed messages', () => {
  const cases = [
    ['(a', 'invalid pattern: unbalanced parentheses'],
    ['a)', 'invalid pattern: unbalanced parentheses'],
    ['((a)', 'invalid pattern: unbalanced parentheses'],
    [')', 'invalid pattern: unbalanced parentheses'],
    ['(a(b)', 'invalid pattern: unbalanced parentheses'],
    ['a\\', 'invalid pattern: trailing backslash'],
    ['\\', 'invalid pattern: trailing backslash'],
    ['*a', 'invalid pattern: quantifier with nothing to quantify'],
    ['+a', 'invalid pattern: quantifier with nothing to quantify'],
    ['?a', 'invalid pattern: quantifier with nothing to quantify'],
    ['a|*', 'invalid pattern: quantifier with nothing to quantify'],
    ['(*)', 'invalid pattern: quantifier with nothing to quantify'],
    ['a**', 'invalid pattern: quantifier with nothing to quantify'],
    ['a*?', 'invalid pattern: quantifier with nothing to quantify'],
    ['a??', 'invalid pattern: quantifier with nothing to quantify'],
    ['(a)*?', 'invalid pattern: quantifier with nothing to quantify'],
    ['^*', 'invalid pattern: quantifier with nothing to quantify'],
    ['[abc', 'invalid pattern: bad character class'],
    ['[]', 'invalid pattern: bad character class'],
    ['[^]', 'invalid pattern: bad character class'],
    ['[z-a]', 'invalid pattern: bad character class'],
    ['[a-\\]', 'invalid pattern: bad character class'],
  ];
  for (const [pattern, message] of cases) {
    assert.throws(
      () => compile(pattern),
      (err) => err instanceof TypeError && err.message === message,
      `compile(${JSON.stringify(pattern)})`
    );
  }
  assert.throws(
    () => matchCount('(a', 'aaa'),
    (err) => err instanceof TypeError && err.message === 'invalid pattern: unbalanced parentheses'
  );
  for (const pattern of ['', 'a', '(a)', '((a))', '(a)(b)', '(a(b))c', '(a|b)', 'a\\*b', '\\\\', '[a-z]', '[^a-z]', '[-a]', '[a-]', '[\\]]']) {
    assert.doesNotThrow(() => compile(pattern), `compile(${JSON.stringify(pattern)})`);
  }
});
