import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JobQueue } from '../src/queue.js';

test('higher priority starts first: the low-priority job is not done at t=1 while high still runs', () => {
  // high (priority 5, 5ms) vs low (priority 1, 1ms), one slot.
  // Correct: high runs at t=0, so at t=1 nothing is done and low is pending.
  // Wrong (insertion order): low ran first and would be done at t=1.
  let t = 0;
  const q = new JobQueue({ maxConcurrent: 1, maxAttempts: 1, now: () => t });
  q.add({ id: 'low', priority: 1, deps: [], durationMs: 1 });
  q.add({ id: 'high', priority: 5, deps: [], durationMs: 5 });
  q.tick();
  assert.deepEqual(q.stats(), { pending: 1, running: 1, done: 0, failed: 0, expired: 0, blocked: 0 });
  t = 1;
  q.tick();
  assert.deepEqual(q.stats(), { pending: 1, running: 1, done: 0, failed: 0, expired: 0, blocked: 0 },
    'high (priority 5) is the job that started; low never ran');
  t = 5;
  q.tick();
  assert.deepEqual(q.stats(), { pending: 1, running: 0, done: 1, failed: 0, expired: 0, blocked: 0 });
  q.tick();
  assert.deepEqual(q.stats(), { pending: 0, running: 1, done: 1, failed: 0, expired: 0, blocked: 0 },
    'low finally gets the freed slot');
});
