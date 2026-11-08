import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JobQueue } from '../src/queue.js';

test('blocked and expired jobs never consume a slot; live jobs run beside them and dead subtrees stay dead', () => {
  let t = 0;
  const q = new JobQueue({ maxConcurrent: 1, maxAttempts: 1, now: () => t });
  q.add({ id: 'gone', priority: 9, deps: [], durationMs: 1, deadlineMs: 1 });
  q.add({ id: 'blocked-one', priority: 8, deps: ['gone'], durationMs: 1 });
  q.add({ id: 'live', priority: 1, deps: [], durationMs: 50 });
  t = 1;
  q.tick(); // gone expires; blocked-one blocks; live starts in the one slot
  assert.deepEqual(q.stats(), { pending: 0, running: 1, done: 0, failed: 0, expired: 1, blocked: 1 });
  t = 51;
  q.tick(); // live finishes
  assert.deepEqual(q.stats(), { pending: 0, running: 0, done: 1, failed: 0, expired: 1, blocked: 1 });
  t = 100;
  q.tick();
  assert.deepEqual(q.stats(), { pending: 0, running: 0, done: 1, failed: 0, expired: 1, blocked: 1 },
    'the dead subtree stays dead');

  // a waiting job with a never-added dep still expires at its deadline
  const q2 = new JobQueue({ maxConcurrent: 4, maxAttempts: 3, now: () => 0 });
  q2.add({ id: 'orphan-waiter', priority: 1, deps: ['ghost'], durationMs: 1, deadlineMs: 20 });
  q2.tick(); // dep missing: stays pending
  assert.deepEqual(q2.stats(), { pending: 1, running: 0, done: 0, failed: 0, expired: 0, blocked: 0 });
  const q3 = new JobQueue({ maxConcurrent: 4, maxAttempts: 3, now: () => 20 });
  q3.add({ id: 'orphan-waiter', priority: 1, deps: ['ghost'], durationMs: 1, deadlineMs: 20 });
  q3.tick(); // deadline reached: expired
  assert.deepEqual(q3.stats(), { pending: 0, running: 0, done: 0, failed: 0, expired: 1, blocked: 0 });
});
