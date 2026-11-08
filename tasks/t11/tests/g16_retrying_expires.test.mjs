import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JobQueue } from '../src/queue.js';

test('a retrying job past its deadline expires instead of running its next attempt', () => {
  let t = 0;
  const q = new JobQueue({ maxConcurrent: 1, maxAttempts: 5, now: () => t });
  q.add({ id: 'late!', priority: 1, deps: [], durationMs: 2, deadlineMs: 50 });
  q.tick(); // attempt 1 at t=0 (0 < 50)
  assert.equal(q.stats().running, 1);
  t = 2;
  q.tick(); // attempt 1 fails at t=2; retryAt = 2 + 100 = 102, past the deadline
  assert.deepEqual(q.stats(), { pending: 1, running: 0, done: 0, failed: 0, expired: 0, blocked: 0 });
  t = 50; // deadline reached while retrying
  q.tick(); // expiry check precedes any restart: expired
  assert.deepEqual(q.stats(), { pending: 0, running: 0, done: 0, failed: 0, expired: 1, blocked: 0 });
  t = 200; // well past retryAt too
  q.tick();
  assert.deepEqual(q.stats(), { pending: 0, running: 0, done: 0, failed: 0, expired: 1, blocked: 0 },
    'expired is terminal even past retryAt');
});
