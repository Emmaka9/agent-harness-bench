import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../src/regex.js';

test('backslash escapes metacharacters to literals', () => {
  assert.deepEqual(compile('\\*').exec('**'), { index: 0, groups: ['*'] });
  assert.deepEqual(compile('\\*').exec('x'), null);
  assert.deepEqual(compile('\\+').exec('+'), { index: 0, groups: ['+'] });
  assert.deepEqual(compile('\\?').exec('?'), { index: 0, groups: ['?'] });
  assert.deepEqual(compile('\\.').exec('.'), { index: 0, groups: ['.'] });
  assert.deepEqual(compile('\\.').exec('a'), null);
  assert.deepEqual(compile('\\(').exec('('), { index: 0, groups: ['('] });
  assert.deepEqual(compile('\\)').exec(')'), { index: 0, groups: [')'] });
  assert.deepEqual(compile('\\[').exec('['), { index: 0, groups: ['['] });
  assert.deepEqual(compile('\\]').exec(']'), { index: 0, groups: [']'] });
  assert.deepEqual(compile('\\^').exec('^'), { index: 0, groups: ['^'] });
  assert.deepEqual(compile('\\$').exec('$'), { index: 0, groups: ['$'] });
  assert.deepEqual(compile('\\|').exec('|'), { index: 0, groups: ['|'] });
  assert.deepEqual(compile('\\-').exec('-'), { index: 0, groups: ['-'] });
  assert.deepEqual(compile('\\a').exec('a'), { index: 0, groups: ['a'] });
  assert.deepEqual(compile('\\1').exec('1'), { index: 0, groups: ['1'] });
  assert.deepEqual(compile('x\\*y').exec('x*y'), { index: 0, groups: ['x*y'] });
  assert.deepEqual(compile('a\\*b').exec('a*b'), { index: 0, groups: ['a*b'] });
  assert.deepEqual(compile('a\\*b').exec('ab'), null);
  assert.deepEqual(compile('\\\\').exec('\\'), { index: 0, groups: ['\\'] });
  assert.deepEqual(compile('\\\\').exec('a'), null);
  assert.deepEqual(compile('\\\\\\\\').exec('\\\\'), { index: 0, groups: ['\\\\'] });
  assert.equal(compile('\\\\').test('\\\\'), true);
});
