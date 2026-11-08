import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JobQueue } from '../src/queue.js';

test('deadline is inclusive: expired at exactly deadlineMs, starts one ms before, and stays terminal', () => {
  // Before the deadline: starts normally.
  let t = 0;
  const q1 = new JobQueue({ maxConcurrent: 4, maxAttempts: 3, now: () => t });
  q1.add({ id: 'd', priority: 1, deps: [], durationMs: 100, deadlineMs: 50 });
  t = 49;
  q1.tick(); // 49 < 50
  assert.equal(q1.stats().running, 1);

  // At exactly the deadline: expired, never started.
  const q2 = new JobQueue({ maxConcurrent: 4, maxAttempts: 3, now: () => 50 });
  q2.add({ id: 'd', priority: 1, deps: [], durationMs: 100, deadlineMs: 50 });
  q2.tick();
  assert.deepEqual(q2.stats(), { pending: 0, running: 0, done: 0, failed: 0, expired: 1, blocked: 0 });

  // Past the deadline by any amount: expired.
  const q3 = new JobQueue({ maxConcurrent: 4, maxAttempts: 3, now: () => 51 });
  q3.add({ id: 'd', priority: 1, deps: [], durationMs: 100, deadlineMs: 50 });
  q3.tick();
  assert.deepEqual(q3.stats(), { pending: 0, running: 0, done: 0, failed: 0, expired: 1, blocked: 0 });

  // A deadline already in the past at add time expires on the first tick.
  const q4 = new JobQueue({ maxConcurrent: 4, maxAttempts: 3, now: () => 1000 });
  q4.add({ id: 'already-late', priority: 1, deps: [], durationMs: 1, deadlineMs: 500 });
  assert.equal(q4.stats().pending, 1, 'add does not expire eagerly');
  q4.tick();
  assert.deepEqual(q4.stats(), { pending: 0, running: 0, done: 0, failed: 0, expired: 1, blocked: 0 });

  // A job that started before its deadline still finishes even once now() passes it.
  let t5 = 0;
  const q5 = new JobQueue({ maxConcurrent: 1, maxAttempts: 1, now: () => t5 });
  q5.add({ id: 'edge', priority: 1, deps: [], durationMs: 10, deadlineMs: 10 });
  q5.tick(); // t=0 < 10: starts
  assert.equal(q5.stats().running, 1);
  t5 = 10;
  q5.tick(); // the finish check is not gated by the deadline: done
  assert.deepEqual(q5.stats(), { pending: 0, running: 0, done: 1, failed: 0, expired: 0, blocked: 0 });
});
