import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../src/regex.js';

test('question matches zero or one, greedily taking the one', () => {
  assert.deepEqual(compile('a?').exec('aa'), { index: 0, groups: ['a'] });
  assert.deepEqual(compile('a?').exec(''), { index: 0, groups: [''] });
  assert.deepEqual(compile('a?b').exec('ab'), { index: 0, groups: ['ab'] });
  assert.deepEqual(compile('a?b').exec('b'), { index: 0, groups: ['b'] });
  assert.deepEqual(compile('colou?r').exec('color'), { index: 0, groups: ['color'] });
  assert.deepEqual(compile('colou?r').exec('colour'), { index: 0, groups: ['colour'] });
  assert.deepEqual(compile('colou?r').exec('colouur'), null);
  assert.deepEqual(compile('a?b?').exec('ba'), { index: 0, groups: ['b'] });
  assert.deepEqual(compile('a?b?').exec(''), { index: 0, groups: [''] });
});
