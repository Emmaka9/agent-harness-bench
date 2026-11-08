import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isEmail, isPositiveInt, isNonEmptyString } from '../src/validate.js';

test('isEmail accepts ordinary addresses and rejects malformed ones', () => {
  assert.equal(isEmail('alice@example.com'), true);
  assert.equal(isEmail('a@b.co'), true);
  assert.equal(isEmail('first.last@sub.domain.org'), true);
  assert.equal(isEmail('bob@host'), false);
  assert.equal(isEmail('@example.com'), false);
  assert.equal(isEmail('bob@'), false);
  assert.equal(isEmail('bob@example'), false);
  assert.equal(isEmail('bob example.com'), false);
  assert.equal(isEmail('bob@exa mple.com'), false);
});

test('isEmail requires a string', () => {
  for (const v of [undefined, null, 123, { x: 1 }, ['a@b.co'], true]) {
    assert.equal(isEmail(v), false, `isEmail(${String(v)}) should be false`);
  }
});

test('isPositiveInt accepts only integers greater than zero', () => {
  assert.equal(isPositiveInt(1), true);
  assert.equal(isPositiveInt(3), true);
  assert.equal(isPositiveInt(1000000), true);
  assert.equal(isPositiveInt(0), false);
  assert.equal(isPositiveInt(-1), false);
  assert.equal(isPositiveInt(1.5), false);
  assert.equal(isPositiveInt(NaN), false);
  assert.equal(isPositiveInt(Infinity), false);
  assert.equal(isPositiveInt(-Infinity), false);
});

test('isPositiveInt requires a number', () => {
  for (const v of ['3', null, undefined, true, [3], { n: 3 }]) {
    assert.equal(isPositiveInt(v), false, `isPositiveInt(${String(v)}) should be false`);
  }
});

test('isNonEmptyString enforces length bounds without trimming', () => {
  assert.equal(isNonEmptyString('a'), true);
  assert.equal(isNonEmptyString(' '), true);
  assert.equal(isNonEmptyString('abc'), true);
  assert.equal(isNonEmptyString(''), false);
  assert.equal(isNonEmptyString('   '), true);
  assert.equal(isNonEmptyString('a', 1), true);
  assert.equal(isNonEmptyString('abc', 3), true);
  assert.equal(isNonEmptyString('abcd', 3), false);
});

test('isNonEmptyString with no maxLen accepts any length and rejects non-strings', () => {
  assert.equal(isNonEmptyString('x'.repeat(500)), true);
  for (const v of [undefined, null, 5, ['a'], { s: 'a' }, false]) {
    assert.equal(isNonEmptyString(v), false, `isNonEmptyString(${String(v)}) should be false`);
    assert.equal(isNonEmptyString(v, 10), false, `isNonEmptyString(${String(v)}, 10) should be false`);
  }
});
