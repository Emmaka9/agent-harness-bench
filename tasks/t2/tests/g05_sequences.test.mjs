import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TokenBucketLimiter } from '../src/limiter.js';

test('long-running trace mixing allows and retry probes', () => {
  let t = 0;
  const limiter = new TokenBucketLimiter({ rate: 2, burst: 3, now: () => t });
  const log = [];
  log.push(limiter.allow('k', 2));       // 3 -> 1
  log.push(limiter.allow('k', 2));       // false (1 < 2)
  log.push(limiter.retryAfterMs('k', 2)); // (2-1)/2*1000 = 500
  t = 250; // +0.5 -> 1.5
  log.push(limiter.allow('k', 2));       // false
  log.push(limiter.retryAfterMs('k', 2)); // (2-1.5)/2*1000 = 250
  t = 500; // +0.5 -> 2
  log.push(limiter.allow('k', 2));       // true -> 0
  log.push(limiter.retryAfterMs('k', 2)); // (2-0)/2*1000 = 1000
  t = 1000; // +1 -> 1
  log.push(limiter.allow('k', 1));       // true -> 0
  log.push(limiter.allow('k', 1));       // false
  log.push(limiter.retryAfterMs('k', 1)); // 500
  assert.deepEqual(log, [true, false, 500, false, 250, true, 1000, true, false, 500]);
});

test('time going backwards cannot add tokens or exceed burst', () => {
  let t = 1000;
  const limiter = new TokenBucketLimiter({ rate: 2, burst: 2, now: () => t });
  assert.equal(limiter.allow('k'), true); // tokens 2 -> 1, lastMs 1000
  t = 875; // elapsed -125: refill -0.25 -> tokens 0.75, lastMs 875
  assert.equal(limiter.allow('k'), false);
  assert.equal(limiter.retryAfterMs('k'), 125); // (1-0.75)*1000/2, state unchanged
  t = 1000; // elapsed 125: +0.25 -> tokens 1, lastMs 1000
  assert.equal(limiter.allow('k'), true); // -> 0
  assert.equal(limiter.retryAfterMs('k'), 500); // (1-0)*1000/2
  t = 2000; // elapsed 1000: refill would be +2, capped at burst 2
  assert.equal(limiter.allow('k'), true); // -> 1
  assert.equal(limiter.allow('k'), true); // -> 0
  assert.equal(limiter.allow('k'), false);
  t = 2250; // elapsed 250: +0.5 -> 0.5
  assert.equal(limiter.allow('k'), false);
  assert.equal(limiter.retryAfterMs('k'), 250); // (1-0.5)*1000/2
});

test('two keys with different usage histories behave independently', () => {
  let t = 0;
  const limiter = new TokenBucketLimiter({ rate: 1, burst: 2, now: () => t });
  assert.equal(limiter.allow('a'), true); // a: 2 -> 1, lastMs 0
  assert.equal(limiter.allow('a'), true); // a: 1 -> 0
  t = 1000;
  assert.equal(limiter.allow('b'), true); // b created full at t=1000: 2 -> 1
  assert.equal(limiter.allow('b'), true); // b: 1 -> 0
  t = 1250;
  assert.equal(limiter.retryAfterMs('a'), 0); // a refilled +1.25, capped at 2
  assert.equal(limiter.retryAfterMs('b'), 750); // b refilled +0.25 only
  assert.equal(limiter.allow('a'), true); // spends 1 of 1.25 -> 0.25, lastMs 1250
  assert.equal(limiter.allow('b'), false); // 0.25 < 1, lastMs 1250
  t = 1500;
  assert.equal(limiter.allow('a'), false); // a: +0.25 -> 0.5
  assert.equal(limiter.retryAfterMs('b'), 500); // b: +0.25 -> 0.5, needs 0.5 more
  t = 1750;
  assert.equal(limiter.allow('a'), false); // a: +0.25 -> 0.75
  t = 2000;
  assert.equal(limiter.allow('a'), true); // a: +0.25 -> 1
  assert.equal(limiter.allow('b'), true); // b: +0.5 since 1500 -> 1
});

test('nan and non-number keys are just ordinary map keys', () => {
  let t = 0;
  const limiter = new TokenBucketLimiter({ rate: 1, burst: 1, now: () => t });
  assert.equal(limiter.allow(NaN), true);
  assert.equal(limiter.allow(NaN), false);
  assert.equal(limiter.allow(1), true);
  assert.equal(limiter.allow('1'), true);
  const obj = {};
  assert.equal(limiter.allow(obj), true);
  assert.equal(limiter.allow(obj), false);
  const limiter2 = new TokenBucketLimiter({ rate: 1, burst: 2, now: () => t });
  assert.equal(limiter2.allow('a'), true); // separate instance: fresh full bucket
  assert.equal(limiter2.allow('a'), true);
  assert.equal(limiter2.allow('a'), false);
});

test('allow and retry call counts follow the spec exactly', () => {
  let t = 0;
  let calls = 0;
  const limiter = new TokenBucketLimiter({ rate: 1, burst: 4, now: () => { calls++; return t; } });
  limiter.allow('k'); // bucket creation (1 call) + refill (1 call)
  assert.equal(calls, 2);
  limiter.allow('k'); // existing bucket: refill only
  assert.equal(calls, 3);
  assert.equal(limiter.retryAfterMs('k'), 0); // refill only: 1 call
  assert.equal(calls, 4);
});
