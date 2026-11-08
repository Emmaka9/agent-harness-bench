import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JobQueue } from '../src/queue.js';

test('a retrying job counts under pending and the six-key contract holds mid-retry', () => {
  let t = 0;
  const q = new JobQueue({ maxConcurrent: 2, maxAttempts: 5, now: () => t });
  q.add({ id: 'r!', priority: 1, deps: [], durationMs: 2 });
  q.tick(); // attempt 1 starts
  assert.deepEqual(q.stats(), { pending: 0, running: 1, done: 0, failed: 0, expired: 0, blocked: 0 });
  t = 2;
  q.tick(); // attempt 1 fails: retrying
  const s = q.stats();
  assert.deepEqual(Object.keys(s).sort(), ['blocked', 'done', 'expired', 'failed', 'pending', 'running']);
  assert.equal(s.pending, 1, 'retrying is reported as pending');
  assert.equal(s.running, 0);
  // the retry cycle continues deterministically: 'r!' never succeeds
  t = 102; // retryAt = 2 + 100
  q.tick(); // attempt 2 starts
  assert.equal(q.stats().running, 1);
  t = 104;
  q.tick(); // attempt 2 fails too (2 < 5): retrying again, retryAt = 104 + 200 = 304
  assert.deepEqual(q.stats(), { pending: 1, running: 0, done: 0, failed: 0, expired: 0, blocked: 0 });
});
