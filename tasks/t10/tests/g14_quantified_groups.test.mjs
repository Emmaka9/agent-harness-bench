import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../src/regex.js';

test('quantified groups capture the last completed repetition', () => {
  assert.deepEqual(compile('(a)+').exec('aaa'), { index: 0, groups: ['aaa', 'a'] });
  assert.deepEqual(compile('(ab)+').exec('ababab'), { index: 0, groups: ['ababab', 'ab'] });
  assert.deepEqual(compile('(ab)+').exec('aba'), { index: 0, groups: ['ab', 'ab'] });
  assert.deepEqual(compile('(ab)+c').exec('ababc'), { index: 0, groups: ['ababc', 'ab'] });
  assert.deepEqual(compile('(a|b)*c').exec('ababc'), { index: 0, groups: ['ababc', 'b'] });
  assert.deepEqual(compile('(a|b)*c').exec('ababd'), null);
  assert.deepEqual(compile('(ab)+(c)?').exec('ababc'), { index: 0, groups: ['ababc', 'ab', 'c'] });
  assert.deepEqual(compile('((a)|(b))+').exec('ab'), { index: 0, groups: ['ab', 'b', undefined, 'b'] });
  assert.deepEqual(compile('((a)|(b))+').exec('ba'), { index: 0, groups: ['ba', 'a', 'a', undefined] });
});
