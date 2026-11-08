import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JobQueue } from '../src/queue.js';

test('an expired dep blocks its dependents and blocked propagates transitively, terminally', () => {
  let t = 0;
  const q = new JobQueue({ maxConcurrent: 4, maxAttempts: 3, now: () => t });
  q.add({ id: 'root', priority: 1, deps: [], durationMs: 1, deadlineMs: 10 });
  q.add({ id: 'child', priority: 1, deps: ['root'], durationMs: 1 });
  q.add({ id: 'grandchild', priority: 1, deps: ['child'], durationMs: 1 });
  t = 10; // root's deadline
  q.tick(); // root expires; child and grandchild block in the same pass
  assert.deepEqual(q.stats(), { pending: 0, running: 0, done: 0, failed: 0, expired: 1, blocked: 2 },
    'blocked propagates transitively in one tick');
  t = 10_000;
  q.tick();
  assert.deepEqual(q.stats(), { pending: 0, running: 0, done: 0, failed: 0, expired: 1, blocked: 2 },
    'blocked is terminal and does not recover');
});

test('a failed dep blocks its dependents; a blocked dep blocks its own in the same pass', () => {
  let t = 0;
  const q = new JobQueue({ maxConcurrent: 2, maxAttempts: 1, now: () => t });
  q.add({ id: 'root!', priority: 1, deps: [], durationMs: 1 });
  q.add({ id: 'mid', priority: 1, deps: ['root!'], durationMs: 1 });
  q.add({ id: 'leaf', priority: 1, deps: ['mid'], durationMs: 1 });
  q.tick(); // root! starts
  t = 1;
  q.tick(); // root! fails terminally (maxAttempts 1)
  assert.deepEqual(q.stats(), { pending: 2, running: 0, done: 0, failed: 1, expired: 0, blocked: 0 });
  q.tick(); // mid AND leaf both block in this pass (fixpoint propagation)
  assert.deepEqual(q.stats(), { pending: 0, running: 0, done: 0, failed: 1, expired: 0, blocked: 2 });
  t = 1000;
  q.tick();
  assert.deepEqual(q.stats(), { pending: 0, running: 0, done: 0, failed: 1, expired: 0, blocked: 2 },
    'blocked stays terminal');
});
