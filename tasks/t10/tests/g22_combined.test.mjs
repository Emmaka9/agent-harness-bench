import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compile, matchCount } from '../src/regex.js';

test('combined constructs: leftmost wins, greedy mixed quantifiers, escapes with classes', () => {
  assert.deepEqual(compile('a|aa').exec('aa'), { index: 0, groups: ['a'] });
  assert.deepEqual(compile('aa|a').exec('aa'), { index: 0, groups: ['aa'] });
  assert.deepEqual(compile('(a|aa)+b').exec('aaab'), { index: 0, groups: ['aaab', 'a'] });
  assert.deepEqual(compile('(a|ab)+c').exec('ababc'), { index: 0, groups: ['ababc', 'ab'] });
  assert.deepEqual(compile('(a|ab)+c').exec('abx'), null);
  assert.deepEqual(compile('a*a*a*b').exec('aaab'), { index: 0, groups: ['aaab'] });
  assert.deepEqual(compile('a*a*a*b').exec('b'), { index: 0, groups: ['b'] });
  assert.deepEqual(compile('a*a*a*b').exec('x'), null);
  assert.deepEqual(compile('^\\([0-9]+\\)$').exec('(123)'), { index: 0, groups: ['(123)'] });
  assert.deepEqual(compile('^\\([0-9]+\\)$').exec('(12a)'), null);
  assert.deepEqual(compile('[A-Z][a-z]*').exec('Hello world'), { index: 0, groups: ['Hello'] });
  assert.deepEqual(compile('[A-Z][a-z]*').exec('hello'), null);
  assert.deepEqual(compile('(a+)(b+)(c+)').exec('xaabbcy'), { index: 1, groups: ['aabbc', 'aa', 'bb', 'c'] });
  assert.deepEqual(compile('(a|b)+').exec('abcd'), { index: 0, groups: ['ab', 'b'] });
  assert.equal(matchCount('(a|b)+', 'abcd'), 1);
  assert.deepEqual(compile('a*a*').exec('aaaa'), { index: 0, groups: ['aaaa'] });
  assert.deepEqual(compile('a*a*b').exec('b'), { index: 0, groups: ['b'] });
  assert.deepEqual(compile('w\\(x\\)?').exec('w(x)'), { index: 0, groups: ['w(x)'] });
  assert.deepEqual(compile('w\\(x\\)?').exec('w'), null);
});
