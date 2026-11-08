import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../src/regex.js';

test('groups that do not participate in the match capture undefined', () => {
  assert.deepEqual(compile('(a)|(b)').exec('b'), { index: 0, groups: ['b', undefined, 'b'] });
  assert.deepEqual(compile('(a)|(b)').exec('a'), { index: 0, groups: ['a', 'a', undefined] });
  assert.deepEqual(compile('(a)|(b)|(c)|(d)').exec('d'), { index: 0, groups: ['d', undefined, undefined, undefined, 'd'] });
  assert.deepEqual(compile('(a)(b)?').exec('a'), { index: 0, groups: ['a', 'a', undefined] });
  assert.deepEqual(compile('(x(y)?)').exec('x'), { index: 0, groups: ['x', 'x', undefined] });
  assert.deepEqual(compile('(x(y)?)').exec('xy'), { index: 0, groups: ['xy', 'xy', 'y'] });
  assert.deepEqual(compile('(ab)(c)?').exec('ab'), { index: 0, groups: ['ab', 'ab', undefined] });
});
