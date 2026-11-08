import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JobQueue } from '../src/queue.js';

test('a job exhausting maxAttempts becomes failed and terminal; maxAttempts 1 fails with no retry', () => {
  let t = 0;
  const q = new JobQueue({ maxConcurrent: 2, maxAttempts: 2, now: () => t });
  q.add({ id: 'dead!', priority: 1, deps: [], durationMs: 1 });

  q.tick(); // attempt 1 at t=0
  assert.equal(q.stats().running, 1);
  t = 1;
  q.tick(); // attempt 1 fails (attempts 1 < maxAttempts 2): retrying
  assert.deepEqual(q.stats(), { pending: 1, running: 0, done: 0, failed: 0, expired: 0, blocked: 0 });

  t = 101; // retryAt = 1 + 100
  q.tick(); // attempt 2 starts
  assert.equal(q.stats().running, 1);
  t = 102;
  q.tick(); // attempt 2 fails with attempts(2) >= maxAttempts(2): failed
  assert.deepEqual(q.stats(), { pending: 0, running: 0, done: 0, failed: 1, expired: 0, blocked: 0 });

  t = 10_000;
  q.tick();
  assert.deepEqual(q.stats(), { pending: 0, running: 0, done: 0, failed: 1, expired: 0, blocked: 0 },
    'failed is terminal');

  // maxAttempts 1: the very first failed attempt is terminal
  let t2 = 0;
  const q2 = new JobQueue({ maxConcurrent: 2, maxAttempts: 1, now: () => t2 });
  q2.add({ id: 'once!', priority: 1, deps: [], durationMs: 2 });
  q2.tick(); // attempt 1 starts at t=0
  assert.equal(q2.stats().running, 1);
  t2 = 2;
  q2.tick(); // attempt 1 finishes and fails with attempts(1) >= maxAttempts(1): failed, no retry
  assert.deepEqual(q2.stats(), { pending: 0, running: 0, done: 0, failed: 1, expired: 0, blocked: 0 });
  t2 = 10_000;
  q2.tick();
  assert.equal(q2.stats().failed, 1, 'no retry happens at any later time');

  // a never-failing job with the same maxAttempts is unaffected
  const q3 = new JobQueue({ maxConcurrent: 2, maxAttempts: 1, now: () => 0 });
  q3.add({ id: 'fine', priority: 1, deps: [], durationMs: 0 });
  q3.tick();
  assert.deepEqual(q3.stats(), { pending: 0, running: 0, done: 1, failed: 0, expired: 0, blocked: 0 });
});
