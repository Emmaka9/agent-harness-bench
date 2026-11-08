import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LRUTTLCache } from '../src/cache.js';

const FROZEN = () => 42;

test('inserting one more entry than capacity evicts the least-recently-used stored entry', () => {
  const c = new LRUTTLCache({ capacity: 3, ttlMs: 1000, now: FROZEN });
  c.set('a', 1);
  c.set('b', 2);
  c.set('c', 3);
  assert.equal(c.size, 3);
  c.set('d', 4); // 'a' is LRU -> evicted
  assert.equal(c.size, 3);
  assert.equal(c.has('a'), false);
  assert.equal(c.get('b'), 2);
  assert.equal(c.get('c'), 3);
  assert.equal(c.get('d'), 4);
});

test('a successful get refreshes recency so the touched key survives eviction', () => {
  const c = new LRUTTLCache({ capacity: 3, ttlMs: 1000, now: FROZEN });
  c.set('a', 1);
  c.set('b', 2);
  c.set('c', 3);
  assert.equal(c.get('a'), 1); // order is now b, c, a
  c.set('d', 4); // evicts 'b'
  assert.equal(c.has('b'), false);
  assert.equal(c.get('a'), 1);
  assert.equal(c.get('c'), 3);
  assert.equal(c.get('d'), 4);
});

test('set over an existing key refreshes recency, while has and size never change it', () => {
  const c = new LRUTTLCache({ capacity: 3, ttlMs: 1000, now: FROZEN });
  c.set('a', 1);
  c.set('b', 2);
  c.set('c', 3);
  c.set('a', 10); // a becomes MRU: order b, c, a
  assert.equal(c.has('a'), true); // recency untouched
  assert.equal(c.size, 3); // recency untouched
  c.set('d', 4); // evicts 'b'
  assert.equal(c.has('b'), false);
  assert.equal(c.get('a'), 10);
  assert.equal(c.get('c'), 3);
  assert.equal(c.get('d'), 4);
});

test('a failed (expired) get removes the entry and leaves the recency of the rest untouched', () => {
  let t = 0;
  const c = new LRUTTLCache({ capacity: 2, ttlMs: 100, now: () => t });
  c.set('a', 1); // deadline 100
  t = 30;
  c.set('b', 2); // deadline 130; recency: a, b
  t = 100; // a is expired, b still live
  assert.equal(c.get('a'), undefined); // failed get: removes a
  assert.equal(c.size, 1);
  c.set('c', 3); // stored: b, c -> no eviction
  assert.equal(c.get('b'), 2, 'b was not evicted by the insert of c');
  assert.equal(c.get('c'), 3);
  assert.equal(c.has('a'), false);
});

test('delete removes the key from recency consideration and size never triggers eviction', () => {
  const c = new LRUTTLCache({ capacity: 2, ttlMs: 1000, now: FROZEN });
  c.set('a', 1);
  c.set('b', 2);
  c.delete('a');
  c.set('c', 3); // only b, c stored -> nothing evicted
  assert.equal(c.size, 2);
  assert.equal(c.get('b'), 2);
  assert.equal(c.get('c'), 3);
  c.set('d', 4); // stored: b, c -> 3 > 2 -> evict 'b', the LRU after 'a' was deleted
  assert.equal(c.has('b'), false, 'b was the LRU once a was deleted');
  assert.equal(c.get('c'), 3);
  assert.equal(c.get('d'), 4);
  assert.equal(c.size, 2);

  const d = new LRUTTLCache({ capacity: 2, ttlMs: 1000, now: FROZEN });
  d.set('a', 1);
  d.set('b', 2);
  assert.equal(d.size, 2);
  assert.equal(d.size, 2);
  d.set('c', 3); // evicts 'a' even though size was read repeatedly
  assert.equal(d.has('a'), false);
  assert.equal(d.get('b'), 2);
  assert.equal(d.get('c'), 3);
});

test('eviction ignores expiry, and a capacity 1 cache holds only the most recent key', () => {
  let t = 0;
  const c = new LRUTTLCache({ capacity: 2, ttlMs: 100, now: () => t });
  c.set('a', 1); // expires at 100
  c.set('b', 2); // expires at 100, newer than a
  t = 50; // both still live
  c.set('c', 3); // over capacity -> evict 'a' regardless of expiry
  assert.equal(c.size, 2);
  assert.equal(c.has('a'), false);
  assert.equal(c.get('b'), 2);
  assert.equal(c.get('c'), 3);

  const e = new LRUTTLCache({ capacity: 2, ttlMs: 100, now: () => t });
  e.set('x', 1); // deadline 150
  t = 200; // x is expired but must stay stored
  e.set('y', 2);
  assert.equal(e.delete('x'), true, 'set does not purge expired entries eagerly');
  assert.equal(e.size, 1);

  const one = new LRUTTLCache({ capacity: 1, ttlMs: 1000, now: FROZEN });
  one.set('a', 1);
  one.set('b', 2);
  assert.equal(one.size, 1);
  assert.equal(one.has('a'), false);
  assert.equal(one.get('b'), 2);
  one.set('b', 3);
  assert.equal(one.get('b'), 3);
  assert.equal(one.size, 1);
});
