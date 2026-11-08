import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../src/regex.js';

test('an empty iteration is not taken once the quantifier minimum is satisfied', () => {
  assert.deepEqual(compile('(a*)*').exec('aaa'), { index: 0, groups: ['aaa', 'aaa'] });
  assert.deepEqual(compile('(a*)*').exec(''), { index: 0, groups: ['', undefined] });
  assert.deepEqual(compile('(a*)+').exec(''), { index: 0, groups: ['', ''] });
  assert.deepEqual(compile('(a*)+').exec('aaa'), { index: 0, groups: ['aaa', 'aaa'] });
  assert.deepEqual(compile('(a*)*b').exec('aaab'), { index: 0, groups: ['aaab', 'aaa'] });
  assert.deepEqual(compile('(a*)*b').exec('b'), { index: 0, groups: ['b', undefined] });
  assert.deepEqual(compile('(a?)*x').exec('aaax'), { index: 0, groups: ['aaax', 'a'] });
  assert.deepEqual(compile('(a?)*x').exec('aabx'), { index: 3, groups: ['x', undefined] });
  assert.deepEqual(compile('()*').exec('ab'), { index: 0, groups: ['', undefined] });
  assert.deepEqual(compile('()+').exec('ab'), { index: 0, groups: ['', ''] });
});
