import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JobQueue } from '../src/queue.js';

test('a job starts on the first tick and finishes inclusively at start+durationMs; zero-duration finishes in-pass', () => {
  let t = 100;
  const q = new JobQueue({ maxConcurrent: 2, maxAttempts: 2, now: () => t });
  q.add({ id: 'a', priority: 1, deps: [], durationMs: 10 });
  assert.deepEqual(q.stats(), { pending: 1, running: 0, done: 0, failed: 0, expired: 0, blocked: 0 });
  q.tick(); // starts at t=100
  assert.deepEqual(q.stats(), { pending: 0, running: 1, done: 0, failed: 0, expired: 0, blocked: 0 });
  t = 109;
  q.tick(); // 109 < 110: still running
  assert.deepEqual(q.stats(), { pending: 0, running: 1, done: 0, failed: 0, expired: 0, blocked: 0 });
  t = 110; // 110 === 100 + 10: inclusive finish
  q.tick();
  assert.deepEqual(q.stats(), { pending: 0, running: 0, done: 1, failed: 0, expired: 0, blocked: 0 });
  t = 5000;
  q.tick();
  assert.deepEqual(q.stats(), { pending: 0, running: 0, done: 1, failed: 0, expired: 0, blocked: 0 });

  // zero-duration: starts and finishes within the same pass, up to the cap
  const q2 = new JobQueue({ maxConcurrent: 3, maxAttempts: 2, now: () => 5 });
  q2.add({ id: 'z0', priority: 1, deps: [], durationMs: 0 });
  q2.add({ id: 'z1', priority: 1, deps: [], durationMs: 0 });
  q2.add({ id: 'z2', priority: 1, deps: [], durationMs: 0 });
  q2.add({ id: 'z3', priority: 1, deps: [], durationMs: 0 });
  q2.tick(); // three start and finish; the fourth waits for a free slot
  assert.deepEqual(q2.stats(), { pending: 1, running: 0, done: 3, failed: 0, expired: 0, blocked: 0 });
  q2.tick(); // the fourth starts and finishes in this pass
  assert.deepEqual(q2.stats(), { pending: 0, running: 0, done: 4, failed: 0, expired: 0, blocked: 0 });
});
