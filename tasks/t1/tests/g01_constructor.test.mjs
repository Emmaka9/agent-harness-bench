import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LRUTTLCache } from '../src/cache.js';

const CAP_MSG = 'capacity must be an integer >= 1';
const TTL_MSG = 'ttlMs must be a finite number >= 0';
const NOW_MSG = 'now must be a function or undefined';

test('constructor throws the capacity message for every invalid capacity', () => {
  const bad = [0, -1, -100, 1.5, NaN, Infinity, '2', null, undefined];
  for (const capacity of bad) {
    assert.throws(
      () => new LRUTTLCache({ capacity, ttlMs: 1000 }),
      (err) => err instanceof TypeError && err.message === CAP_MSG,
      `capacity=${String(capacity)}`
    );
  }
  assert.throws(
    () => new LRUTTLCache(),
    (err) => err instanceof TypeError && err.message === CAP_MSG
  );
});

test('constructor validates capacity first, then ttlMs, then now', () => {
  assert.throws(
    () => new LRUTTLCache({ capacity: 0, ttlMs: -1, now: 42 }),
    (err) => err instanceof TypeError && err.message === CAP_MSG
  );
  assert.throws(
    () => new LRUTTLCache({ capacity: 1, ttlMs: -1, now: 42 }),
    (err) => err instanceof TypeError && err.message === TTL_MSG
  );
  assert.throws(
    () => new LRUTTLCache({ capacity: 1, ttlMs: 1000, now: 42 }),
    (err) => err instanceof TypeError && err.message === NOW_MSG
  );
});

test('constructor throws the ttlMs message for invalid ttlMs and the now message for invalid now', () => {
  for (const ttlMs of [-1, -0.5, NaN, Infinity, -Infinity, '5', null]) {
    assert.throws(
      () => new LRUTTLCache({ capacity: 2, ttlMs }),
      (err) => err instanceof TypeError && err.message === TTL_MSG,
      `ttlMs=${String(ttlMs)}`
    );
  }
  for (const now of [42, 'x', null, true]) {
    assert.throws(
      () => new LRUTTLCache({ capacity: 2, ttlMs: 1000, now }),
      (err) => err instanceof TypeError && err.message === NOW_MSG,
      `now=${String(now)}`
    );
  }
  const c = new LRUTTLCache({ capacity: 2, ttlMs: 1000, now: undefined });
  assert.equal(c.set('k', 'v'), undefined);
  assert.equal(c.get('k'), 'v');
});

test('constructor accepts ttlMs 0 and defaults now to Date.now when omitted', () => {
  const c0 = new LRUTTLCache({ capacity: 3, ttlMs: 0 });
  assert.equal(c0 instanceof LRUTTLCache, true);
  const c = new LRUTTLCache({ capacity: 4, ttlMs: 3_600_000 });
  c.set('k', 'v');
  assert.equal(c.has('k'), true);
  assert.equal(c.get('k'), 'v');
  assert.equal(c.size, 1);
});
