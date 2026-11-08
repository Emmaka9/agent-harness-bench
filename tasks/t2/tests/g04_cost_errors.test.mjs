import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TokenBucketLimiter } from '../src/limiter.js';

test('cost above burst throws RangeError with the exact message', () => {
  const limiter = new TokenBucketLimiter({ rate: 1, burst: 5, now: () => 0 });
  for (const m of ['allow', 'retryAfterMs']) {
    assert.throws(() => limiter[m]('k', 6), RangeError);
    assert.throws(
      () => limiter[m]('k', 6),
      (e) => e instanceof RangeError && e.message === 'cost exceeds burst'
    );
  }
});

test('cost equal to burst is accepted while cost above it throws', () => {
  let t = 0;
  const limiter = new TokenBucketLimiter({ rate: 1, burst: 2, now: () => t });
  assert.equal(limiter.retryAfterMs('k', 2), 0);
  assert.equal(limiter.allow('k', 2), true);
  assert.equal(limiter.allow('k', 2), false);
  t = 2000;
  assert.equal(limiter.allow('k', 2), true);
  t = 2000; // time frozen for the boundary probes below
  assert.throws(() => limiter.allow('k', 3), RangeError);
  assert.throws(() => limiter.retryAfterMs('k', 3), RangeError);
});

test('throwing on cost does not create or update the bucket', () => {
  let t = 0;
  const limiter = new TokenBucketLimiter({ rate: 1, burst: 2, now: () => t });
  assert.throws(() => limiter.allow('k', 3), RangeError);
  t = 100; // bucket created here must start at the burst set at t=100
  assert.equal(limiter.allow('k'), true);
  assert.equal(limiter.allow('k'), true);
  assert.equal(limiter.allow('k'), false);
  t = 150;
  assert.equal(limiter.retryAfterMs('k'), 950); // elapsed 50 since the failed allow at 100
  assert.throws(() => limiter.retryAfterMs('k', 3), RangeError);
  t = 150; // unchanged by the throw
  assert.equal(limiter.retryAfterMs('k'), 950);
});

test('a failed allow leaves tokens at the refilled value', () => {
  let t = 0;
  const limiter = new TokenBucketLimiter({ rate: 1, burst: 2, now: () => t });
  assert.equal(limiter.allow('k', 2), true);
  assert.equal(limiter.allow('k', 2), false);
  t = 1000; // refill +1 -> 1, lastMs 1000
  assert.equal(limiter.allow('k', 2), false);
  assert.equal(limiter.retryAfterMs('k', 2), 1000); // (2-1)*1000/1; state unchanged
  t = 1250; // elapsed 250: +0.25 -> 1.25
  assert.equal(limiter.allow('k', 2), false);
  assert.equal(limiter.retryAfterMs('k', 2), 750);
});
