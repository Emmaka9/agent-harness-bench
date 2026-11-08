import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JobQueue } from '../src/queue.js';

test('retry backoff doubles: 100, then 200, then 400 after each failed attempt', () => {
  let t = 0;
  const q = new JobQueue({ maxConcurrent: 1, maxAttempts: 4, now: () => t });
  q.add({ id: 'boom!', priority: 1, deps: [], durationMs: 1 });

  // attempt 1 starts at t=0
  q.tick();
  assert.deepEqual(q.stats(), { pending: 0, running: 1, done: 0, failed: 0, expired: 0, blocked: 0 });
  t = 1;
  q.tick(); // attempt 1 fails; retryAt = 1 + 100*2^0 = 101
  assert.deepEqual(q.stats(), { pending: 1, running: 0, done: 0, failed: 0, expired: 0, blocked: 0 });

  t = 100; // 100 < 101
  q.tick();
  assert.deepEqual(q.stats(), { pending: 1, running: 0, done: 0, failed: 0, expired: 0, blocked: 0 },
    'backoff not yet elapsed at t=100');
  t = 101;
  q.tick(); // attempt 2 starts
  assert.equal(q.stats().running, 1, 'attempt 2 starts at t=101');

  t = 102;
  q.tick(); // attempt 2 fails; retryAt = 102 + 100*2^1 = 302
  assert.equal(q.stats().pending, 1);
  t = 301;
  q.tick();
  assert.deepEqual(q.stats(), { pending: 1, running: 0, done: 0, failed: 0, expired: 0, blocked: 0 },
    'second backoff gap is 200ms; t=301 is one short');
  t = 302;
  q.tick(); // attempt 3 starts
  assert.equal(q.stats().running, 1);

  t = 303;
  q.tick(); // attempt 3 fails; retryAt = 303 + 100*2^2 = 703
  t = 702;
  q.tick();
  assert.equal(q.stats().running, 0, 'third backoff gap is 400ms; t=702 is one short');
  t = 703;
  q.tick(); // attempt 4 starts
  assert.equal(q.stats().running, 1);
});
