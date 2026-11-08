import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JobQueue } from '../src/queue.js';

test('a job never starts before all of its deps are done, in chain order', () => {
  let t = 0;
  const q = new JobQueue({ maxConcurrent: 4, maxAttempts: 2, now: () => t });
  q.add({ id: 'a', priority: 1, deps: [], durationMs: 10 });
  q.add({ id: 'b', priority: 1, deps: ['a'], durationMs: 10 });
  q.add({ id: 'c', priority: 1, deps: ['a', 'b'], durationMs: 0 });
  q.tick();
  assert.deepEqual(q.stats(), { pending: 2, running: 1, done: 0, failed: 0, expired: 0, blocked: 0 });
  q.tick(); // t=0 still: a has not finished
  assert.deepEqual(q.stats(), { pending: 2, running: 1, done: 0, failed: 0, expired: 0, blocked: 0 });
  t = 10;
  q.tick(); // a finishes; b cannot start until the next pass
  assert.deepEqual(q.stats(), { pending: 2, running: 0, done: 1, failed: 0, expired: 0, blocked: 0 });
  q.tick(); // b starts
  assert.deepEqual(q.stats(), { pending: 1, running: 1, done: 1, failed: 0, expired: 0, blocked: 0 });
  t = 20;
  q.tick(); // b finishes
  assert.deepEqual(q.stats(), { pending: 1, running: 0, done: 2, failed: 0, expired: 0, blocked: 0 });
  q.tick(); // c starts and (durationMs 0) finishes in the same pass
  assert.deepEqual(q.stats(), { pending: 0, running: 0, done: 3, failed: 0, expired: 0, blocked: 0 });
});

test('deps may be added after their dependents; a never-added dep just delays, forever', () => {
  let t = 0;
  const q = new JobQueue({ maxConcurrent: 4, maxAttempts: 1, now: () => t });
  q.add({ id: 'late-dep', priority: 1, deps: ['base'], durationMs: 0 });
  q.add({ id: 'base', priority: 1, deps: [], durationMs: 0 });
  q.tick(); // base starts and finishes; late-dep could not have started first
  assert.deepEqual(q.stats(), { pending: 1, running: 0, done: 1, failed: 0, expired: 0, blocked: 0 });
  q.tick(); // late-dep starts and finishes
  assert.deepEqual(q.stats(), { pending: 0, running: 0, done: 2, failed: 0, expired: 0, blocked: 0 });

  const q2 = new JobQueue({ maxConcurrent: 4, maxAttempts: 2, now: () => t });
  q2.add({ id: 'w', priority: 1, deps: ['ghost'], durationMs: 0 });
  for (let i = 0; i < 5; i++) {
    q2.tick();
    t += 100;
  }
  assert.deepEqual(q2.stats(), { pending: 1, running: 0, done: 0, failed: 0, expired: 0, blocked: 0 },
    'a missing dep delays without blocking, indefinitely');
});
