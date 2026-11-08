import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JobQueue } from '../src/queue.js';

test('a mixed workload plays out deterministically end to end', () => {
  let t = 0;
  const q = new JobQueue({ maxConcurrent: 2, maxAttempts: 3, now: () => t });
  q.add({ id: 'fast', priority: 10, deps: [], durationMs: 1 });
  q.add({ id: 'slow', priority: 5, deps: [], durationMs: 10 });
  q.add({ id: 'follower', priority: 1, deps: ['fast'], durationMs: 2 });
  q.add({ id: 'doomed!', priority: 7, deps: [], durationMs: 1, deadlineMs: 3 });
  q.add({ id: 'needs-doomed', priority: 9, deps: ['doomed!'], durationMs: 1 });
  q.add({ id: 'flaky!', priority: 4, deps: [], durationMs: 1 });

  q.tick(); // t=0: fast (10) and doomed! (7) start; needs-doomed waits on its dep
  assert.deepEqual(q.stats(), { pending: 4, running: 2, done: 0, failed: 0, expired: 0, blocked: 0 });

  t = 1;
  q.tick(); // both slots were busy, so nothing started; fast done, doomed! fails attempt 1
  // doomed!: retrying, retryAt = 1 + 100 = 101
  assert.deepEqual(q.stats(), { pending: 5, running: 0, done: 1, failed: 0, expired: 0, blocked: 0 });

  q.tick(); // slow (5) and flaky! (4) start; follower (1) loses the priority race
  assert.deepEqual(q.stats(), { pending: 3, running: 2, done: 1, failed: 0, expired: 0, blocked: 0 });

  t = 2;
  q.tick(); // slots busy: no starts; flaky! attempt 1 fails: retrying, retryAt = 2 + 100 = 102
  assert.deepEqual(q.stats(), { pending: 4, running: 1, done: 1, failed: 0, expired: 0, blocked: 0 });

  q.tick(); // follower starts in the freed slot (doomed! not due: 2 < 101)
  assert.deepEqual(q.stats(), { pending: 3, running: 2, done: 1, failed: 0, expired: 0, blocked: 0 });

  t = 3; // doomed!'s deadline
  q.tick(); // doomed! (retrying) expires; needs-doomed blocks; slow and follower still run
  assert.deepEqual(q.stats(), { pending: 1, running: 2, done: 1, failed: 0, expired: 1, blocked: 1 });

  t = 10;
  q.tick(); // follower done (10 >= 2+2); slow still running (10 < 11); flaky! not due
  assert.deepEqual(q.stats(), { pending: 1, running: 1, done: 2, failed: 0, expired: 1, blocked: 1 });

  t = 11;
  q.tick(); // slow done (11 >= 1+10)
  assert.deepEqual(q.stats(), { pending: 1, running: 0, done: 3, failed: 0, expired: 1, blocked: 1 });

  t = 102; // flaky!'s retryAt
  q.tick(); // attempt 2 starts
  assert.deepEqual(q.stats(), { pending: 0, running: 1, done: 3, failed: 0, expired: 1, blocked: 1 });

  t = 103;
  q.tick(); // attempt 2 fails (2 < 3): retrying, retryAt = 103 + 200 = 303
  assert.deepEqual(q.stats(), { pending: 1, running: 0, done: 3, failed: 0, expired: 1, blocked: 1 });

  t = 303;
  q.tick(); // attempt 3 starts
  assert.deepEqual(q.stats(), { pending: 0, running: 1, done: 3, failed: 0, expired: 1, blocked: 1 });

  t = 304;
  q.tick(); // attempt 3 fails: attempts(3) >= maxAttempts(3): failed
  assert.deepEqual(q.stats(), { pending: 0, running: 0, done: 3, failed: 1, expired: 1, blocked: 1 });

  t = 1000;
  q.tick();
  assert.deepEqual(q.stats(), { pending: 0, running: 0, done: 3, failed: 1, expired: 1, blocked: 1 },
    'the workload has fully settled');
});
