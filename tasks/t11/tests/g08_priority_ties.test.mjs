import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JobQueue } from '../src/queue.js';

test('equal priorities start in insertion order; later duplicates of priority never overtake', () => {
  // Capacity 2, three equal-priority jobs. p1 and p2 start; p3 waits.
  // p1 has duration 1, p2 duration 50. At t=1 only p1 has finished.
  let t = 0;
  const q = new JobQueue({ maxConcurrent: 2, maxAttempts: 1, now: () => t });
  q.add({ id: 'p1', priority: 4, deps: [], durationMs: 1 });
  q.add({ id: 'p2', priority: 4, deps: [], durationMs: 50 });
  q.add({ id: 'p3', priority: 4, deps: [], durationMs: 50 });
  q.tick();
  assert.deepEqual(q.stats(), { pending: 1, running: 2, done: 0, failed: 0, expired: 0, blocked: 0 });
  t = 1;
  q.tick(); // p1 finishes at the end of this pass; p3 could not start (starts precede finishes)
  assert.deepEqual(q.stats(), { pending: 1, running: 1, done: 1, failed: 0, expired: 0, blocked: 0 });
  t = 51;
  q.tick(); // p2 finishes; p3 starts in the freed slot
  assert.deepEqual(q.stats(), { pending: 0, running: 1, done: 2, failed: 0, expired: 0, blocked: 0 });
  t = 101;
  q.tick(); // p3 finishes
  assert.deepEqual(q.stats(), { pending: 0, running: 0, done: 3, failed: 0, expired: 0, blocked: 0 });
});

test('fractional and negative priorities order correctly', () => {
  // frac (0.5) beats zero (0) beats neg (-5). One slot, discriminating durations.
  let t = 0;
  const q = new JobQueue({ maxConcurrent: 1, maxAttempts: 1, now: () => t });
  q.add({ id: 'neg', priority: -5, deps: [], durationMs: 1 });
  q.add({ id: 'frac', priority: 0.5, deps: [], durationMs: 50 });
  q.add({ id: 'zero', priority: 0, deps: [], durationMs: 1 });
  q.tick();
  t = 1;
  q.tick();
  assert.deepEqual(q.stats(), { pending: 2, running: 1, done: 0, failed: 0, expired: 0, blocked: 0 },
    'frac (priority 0.5) is running; neither lower-priority job finished');
});
