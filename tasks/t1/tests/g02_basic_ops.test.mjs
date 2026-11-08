import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LRUTTLCache } from '../src/cache.js';

// Frozen clock: time never advances, so nothing ever expires in these tests.
const FROZEN = () => 1000;
const make = (capacity = 8) => new LRUTTLCache({ capacity, ttlMs: 1000, now: FROZEN });

test('set/get round-trip with overwrite, and a missing key yields undefined/false/false/0', () => {
  const c = make();
  const obj = { x: 1 };
  assert.equal(c.set('k', obj), undefined);
  assert.equal(c.get('k'), obj);
  assert.equal(c.set('k', 'replacement'), undefined);
  assert.equal(c.get('k'), 'replacement');
  assert.equal(c.get('nope'), undefined);
  assert.equal(c.has('nope'), false);
  assert.equal(c.delete('nope'), false);
  assert.equal(c.size, 1, 'the failed lookups did not disturb the stored entry');

  const empty = make();
  assert.equal(empty.get('nope'), undefined);
  assert.equal(empty.has('nope'), false);
  assert.equal(empty.delete('nope'), false);
  assert.equal(empty.size, 0);
});

test('size counts stored entries, and delete removes an entry so later reads miss', () => {
  const c = make(10);
  assert.equal(c.size, 0);
  c.set('a', 1);
  c.set('b', 2);
  c.set('c', 3);
  assert.equal(c.size, 3);
  assert.equal(c.delete('b'), true);
  assert.equal(c.size, 2);
  assert.equal(c.delete('b'), false);
  assert.equal(c.size, 2);

  const d = make();
  d.set('k', 'v');
  assert.equal(d.has('k'), true);
  assert.equal(d.delete('k'), true);
  assert.equal(d.has('k'), false);
  assert.equal(d.get('k'), undefined);
  assert.equal(d.size, 0);
  assert.equal(d.delete('k'), false);
});

test('undefined is a valid value and keys use SameValueZero including NaN and -0', () => {
  const c = make();
  c.set('k', undefined);
  assert.equal(c.has('k'), true);
  assert.equal(c.get('k'), undefined);
  assert.equal(c.size, 1);
  assert.equal(c.delete('k'), true);
  assert.equal(c.has('k'), false);
  c.set(NaN, 'nan-val');
  assert.equal(c.has(NaN), true);
  assert.equal(c.get(NaN), 'nan-val');
  c.set(0, 'zero');
  assert.equal(c.get(-0), 'zero');
  c.set(-0, 'neg-zero');
  assert.equal(c.get(0), 'neg-zero');
  assert.equal(c.size, 2);
  assert.equal(c.delete(NaN), true);
  assert.equal(c.has(NaN), false);
});

test('delete removes a stored entry regardless of state and subsequent reads miss', () => {
  const c = make();
  c.set('k', 'v');
  assert.equal(c.has('k'), true);
  assert.equal(c.delete('k'), true);
  assert.equal(c.has('k'), false);
  assert.equal(c.get('k'), undefined);
  assert.equal(c.size, 0);
  assert.equal(c.delete('k'), false);
});

