import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TokenBucketLimiter } from '../src/limiter.js';

test('retryAfterMs returns 0 when affordable or for an unknown key', () => {
  let t = 0;
  let calls = 0;
  const limiter = new TokenBucketLimiter({ rate: 1, burst: 2, now: () => { calls++; return t; } });
  assert.equal(limiter.retryAfterMs('k'), 0); // no bucket yet: no now() call
  assert.equal(calls, 0);
  assert.equal(limiter.retryAfterMs('k', 2), 0);
});

test('retryAfterMs scales with cost and handles a fractional rate', () => {
  let t = 0;
  const limiter = new TokenBucketLimiter({ rate: 2, burst: 4, now: () => t });
  assert.equal(limiter.allow('k'), true);
  assert.equal(limiter.allow('k'), true);
  assert.equal(limiter.allow('k'), true);
  assert.equal(limiter.allow('k'), true);
  assert.equal(limiter.allow('k'), false);
  assert.equal(limiter.retryAfterMs('k', 3), 1500); // (3-0)*1000/2
  assert.equal(limiter.retryAfterMs('k', 2), 1000); // (2-0)*1000/2
  assert.equal(limiter.retryAfterMs('k', 2), 1000); // state unchanged by retries
  t = 250; // +0.5 tokens since the spend -> tokens 0.5, lastMs 250
  assert.equal(limiter.retryAfterMs('k'), 250); // (1-0.5)*1000/2
  assert.equal(limiter.retryAfterMs('k', 2), 750); // (2-0.5)*1000/2
});

test('retryAfterMs accounts for a partial refill and fractional rate', () => {
  let t = 0;
  const limiter = new TokenBucketLimiter({ rate: 0.5, burst: 1, now: () => t });
  assert.equal(limiter.allow('k'), true);
  assert.equal(limiter.allow('k'), false);
  t = 1000; // refill +0.5 at rate 0.5
  assert.equal(limiter.retryAfterMs('k'), 1000); // (1-0.5)*1000/0.5
  assert.equal(limiter.retryAfterMs('k'), 1000); // retry does not refill further
  assert.equal(limiter.allow('k'), false); // 0.5 < 1
  t = 2000; // another +0.5 -> full
  assert.equal(limiter.retryAfterMs('k'), 0);
  assert.equal(limiter.allow('k'), true);
  assert.equal(limiter.allow('k'), false);
});

test('retryAfterMs never deducts tokens or moves time', () => {
  let t = 0;
  const limiter = new TokenBucketLimiter({ rate: 1, burst: 1, now: () => t });
  assert.equal(limiter.allow('k'), true);
  assert.equal(limiter.allow('k'), false);
  t = 1000; // bucket refills to 1
  assert.equal(limiter.retryAfterMs('k'), 0);
  t = 1000; // same instant
  assert.equal(limiter.allow('k'), true); // still affordable: retry did not spend it
  assert.equal(limiter.allow('k'), false);
  t = 1100; // 0.1 refilled since the allow at 1000
  assert.equal(limiter.retryAfterMs('k'), 900);
});

test('retryAfterMs does not create a bucket for an unknown key', () => {
  let t = 999;
  let calls = 0;
  const limiter = new TokenBucketLimiter({ rate: 1, burst: 1, now: () => { calls++; return t; } });
  assert.equal(limiter.retryAfterMs('k'), 0); // bucketless: no now() call, no bucket made
  assert.equal(calls, 0);
  assert.equal(limiter.allow('k'), true); // bucket starts full at t=999
  assert.equal(limiter.allow('k'), false);
  t = 1099; // 100ms since the allow at 999
  assert.equal(limiter.retryAfterMs('k'), 900);
});
