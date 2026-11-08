import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TokenBucketLimiter } from '../src/limiter.js';

test('a fresh key starts full and keys are independent buckets', () => {
  let t = 0;
  const limiter = new TokenBucketLimiter({ rate: 1, burst: 2, now: () => t });
  assert.equal(limiter.allow('a'), true);
  assert.equal(limiter.allow('a'), true);
  assert.equal(limiter.allow('a'), false);
  assert.equal(limiter.allow('b'), true); // independent full bucket
  assert.equal(limiter.allow('b'), true);
  assert.equal(limiter.allow('b'), false);
  t = 1000;
  assert.equal(limiter.allow('a'), true); // a refilled +1
  assert.equal(limiter.allow('b'), true); // b refilled +1
});


test('elapsed time refills tokens fractionally', () => {
  let t = 0;
  const limiter = new TokenBucketLimiter({ rate: 1, burst: 2, now: () => t });
  assert.equal(limiter.allow('k'), true); // 1
  assert.equal(limiter.allow('k'), true); // 0
  assert.equal(limiter.allow('k'), false);
  t = 500; // refill 0.5
  assert.equal(limiter.allow('k'), false); // 0.5 < 1, tokens stay 0.5
  t = 1000; // refill another 0.5 -> 1
  assert.equal(limiter.allow('k'), true);
  assert.equal(limiter.allow('k'), false);
});

test('refill is capped at burst', () => {
  let t = 0;
  const limiter = new TokenBucketLimiter({ rate: 2, burst: 2, now: () => t });
  assert.equal(limiter.allow('k'), true);
  assert.equal(limiter.allow('k'), true);
  assert.equal(limiter.allow('k'), false);
  t = 1000000; // far more than enough to refill the whole bucket
  assert.equal(limiter.allow('k'), true);
  assert.equal(limiter.allow('k'), true);
  assert.equal(limiter.allow('k'), false);
});

test('allow deducts cost greater than one', () => {
  let t = 0;
  const limiter = new TokenBucketLimiter({ rate: 1, burst: 5, now: () => t });
  assert.equal(limiter.allow('k', 3), true);
  assert.equal(limiter.allow('k', 3), false); // 2 left
  t = 1000; // +1 -> 3
  assert.equal(limiter.allow('k', 3), true);
  assert.equal(limiter.allow('k', 1), false);
});
