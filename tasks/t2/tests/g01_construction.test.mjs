import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TokenBucketLimiter } from '../src/limiter.js';

test('constructor validates options in order and rejects invalid values', () => {
  assert.throws(
    () => new TokenBucketLimiter({ rate: 0, burst: 0, now: 'x' }),
    (e) => e instanceof TypeError && e.message === 'rate must be a finite number > 0'
  );
  assert.throws(
    () => new TokenBucketLimiter({ rate: 10, burst: 0, now: 'x' }),
    (e) => e instanceof TypeError && e.message === 'burst must be a finite number > 0'
  );
  assert.throws(
    () => new TokenBucketLimiter({ rate: 10, burst: 5, now: 'x' }),
    (e) => e instanceof TypeError && e.message === 'now must be a function or undefined'
  );
  for (const bad of [0, -1, NaN, Infinity, -Infinity, '10', null]) {
    assert.throws(() => new TokenBucketLimiter({ rate: bad, burst: 5 }), TypeError);
    assert.throws(() => new TokenBucketLimiter({ rate: 10, burst: bad }), TypeError);
  }
  assert.doesNotThrow(() => new TokenBucketLimiter({ rate: 1, burst: 1 }));
  assert.doesNotThrow(() => new TokenBucketLimiter({ rate: 1, burst: 1, now: undefined }));
  assert.doesNotThrow(() => new TokenBucketLimiter({ rate: 1, burst: 1, now: () => 0 }));
});

test('buckets are created lazily at first need', () => {
  let t = 100;
  const nowCalls = [];
  const limiter = new TokenBucketLimiter({ rate: 1, burst: 10, now: () => { nowCalls.push(t); return t; } });
  // A retryAfterMs on an unknown key must not create a bucket: no now() call at all.
  assert.equal(limiter.retryAfterMs('ghost', 1), 0);
  assert.deepEqual(nowCalls, []);
  assert.equal(limiter.allow('a', 1), true);
  assert.deepEqual(nowCalls, [100, 100]); // creation timestamp + refill
  nowCalls.length = 0;
  t = 150;
  assert.equal(limiter.allow('a', 1), true); // bucket holds 10, refilled back to 10
  assert.deepEqual(nowCalls, [150]); // existing bucket: exactly one call
});
