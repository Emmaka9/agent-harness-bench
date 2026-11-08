import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LRUTTLCache } from '../src/cache.js';

// Mutable injected clock.
function clock(start = 1000) {
  let t = start;
  return {
    now: () => t,
    advance: (ms) => { t += ms; },
  };
}

test('an entry written at t expires exactly at its deadline t+ttlMs (inclusive boundary)', () => {
  const { now, advance } = clock(1000);
  const c = new LRUTTLCache({ capacity: 5, ttlMs: 100, now });
  c.set('k', 'v');
  advance(99);
  assert.equal(c.has('k'), true, 'one ms before deadline: still live');
  assert.equal(c.get('k'), 'v');
  advance(1); // t === 1100 === deadline
  assert.equal(c.has('k'), false, 'at the deadline the entry is expired');
  assert.equal(c.get('k'), undefined);
});

test('get and has on an expired entry return their falsy result and lazily remove it', () => {
  const { now, advance } = clock(0);
  const c = new LRUTTLCache({ capacity: 5, ttlMs: 50, now });
  c.set('a', 'va');
  c.set('b', 'vb');
  advance(100);
  assert.equal(c.get('a'), undefined);
  assert.equal(c.has('b'), false);
  assert.equal(c.size, 0, 'both expired entries were removed by the accesses');
  assert.equal(c.get('a'), undefined);
  assert.equal(c.has('a'), false);
  assert.equal(c.delete('a'), false, 'the failed get really removed a');
  assert.equal(c.delete('b'), false, 'the failed has really removed b');
});

test('size excludes expired entries but never mutates state', () => {
  const { now, advance } = clock(0);
  const c = new LRUTTLCache({ capacity: 5, ttlMs: 100, now });
  c.set('a', 1);
  c.set('b', 2);
  advance(50);
  c.set('c', 3);
  assert.equal(c.size, 3);
  advance(60); // a and b expired (deadlines 100), c still live (deadline 150)
  assert.equal(c.size, 1, 'size counts only unexpired entries');
  assert.equal(c.size, 1, 'reading size twice is stable');
  advance(41); // c expired too
  assert.equal(c.size, 0);
  assert.equal(c.delete('c'), true, 'expired-but-stored entry is still deletable');
  assert.equal(c.delete('c'), false);
});

test('re-setting an expired key stores a fresh record with a new deadline and revived reads', () => {
  const { now, advance } = clock(0);
  const c = new LRUTTLCache({ capacity: 5, ttlMs: 100, now });
  c.set('k', 'first');
  advance(200); // long expired
  assert.equal(c.has('k'), false);
  c.set('k', 'second');
  assert.equal(c.has('k'), true);
  assert.equal(c.get('k'), 'second');
  advance(99);
  assert.equal(c.has('k'), true);
  advance(1);
  assert.equal(c.has('k'), false);
});

test('set over an expired stored entry refreshes deadline and recency without a spurious eviction', () => {
  const { now, advance } = clock(0);
  const c = new LRUTTLCache({ capacity: 2, ttlMs: 100, now });
  c.set('a', 1);
  advance(10);
  c.set('b', 2);
  advance(200); // both stored entries expired
  c.set('a', 3);
  assert.equal(c.delete('b'), true, 'b is expired but still stored: set of a did not purge it');
  assert.equal(c.size, 1);
  assert.equal(c.get('a'), 3);
  assert.equal(c.has('b'), false, 'b expired and was untouched by the set of a');
});

test('delete works on an expired-but-stored entry, and ttlMs 0 entries are dead on any read', () => {
  const { now, advance } = clock(0);
  const c = new LRUTTLCache({ capacity: 5, ttlMs: 10, now });
  c.set('k', 'v');
  advance(10);
  assert.equal(c.delete('k'), true, 'delete ignores expiry');
  assert.equal(c.delete('k'), false);

  let t = 500;
  const z = new LRUTTLCache({ capacity: 3, ttlMs: 0, now: () => t });
  z.set('k', 'v'); // deadline 500; expired at any read where now() >= 500
  assert.equal(z.delete('k'), true, 'expired-but-stored entry is still deletable');
  assert.equal(z.delete('k'), false, 'the first delete removed it');
  z.set('k2', 'w'); // deadline 500: already expired at write time
  assert.equal(z.delete('k2'), true, 'set does not eagerly purge a write-time-expired entry');
  assert.equal(z.has('k2'), false);
  assert.equal(z.get('k2'), undefined);
  assert.equal(z.size, 0);
});
