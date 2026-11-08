import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JobQueue } from '../src/queue.js';

test('the concurrency cap holds: slots never over-subscribe and frees are reused next pass', () => {
  let t = 0;
  const q = new JobQueue({ maxConcurrent: 2, maxAttempts: 1, now: () => t });
  q.add({ id: 'j0', priority: 4, deps: [], durationMs: 10 });
  q.add({ id: 'j1', priority: 3, deps: [], durationMs: 10 });
  q.add({ id: 'j2', priority: 2, deps: [], durationMs: 10 });
  q.add({ id: 'j3', priority: 1, deps: [], durationMs: 10 });
  q.tick();
  assert.deepEqual(q.stats(), { pending: 2, running: 2, done: 0, failed: 0, expired: 0, blocked: 0 });
  t = 10;
  q.tick(); // j0, j1 finish; slots open only for the next pass
  assert.deepEqual(q.stats(), { pending: 2, running: 0, done: 2, failed: 0, expired: 0, blocked: 0 });
  q.tick(); // j2, j3 start
  assert.deepEqual(q.stats(), { pending: 0, running: 2, done: 2, failed: 0, expired: 0, blocked: 0 });
  t = 20;
  q.tick();
  assert.deepEqual(q.stats(), { pending: 0, running: 0, done: 4, failed: 0, expired: 0, blocked: 0 });

  // maxConcurrent 1 serializes: each job takes a start pass then a finish pass
  const q1 = new JobQueue({ maxConcurrent: 1, maxAttempts: 1, now: () => t });
  for (let i = 0; i < 3; i++) {
    q1.add({ id: 's' + i, priority: 3 - i, deps: [], durationMs: 2 });
  }
  for (let i = 0; i < 3; i++) {
    q1.tick();
    const s = q1.stats();
    assert.ok(s.running <= 1, 'never more than one running');
    t += 2;
    q1.tick();
    assert.equal(q1.stats().done, i + 1, `job ${i} finished in slot order`);
  }
  assert.deepEqual(q1.stats(), { pending: 0, running: 0, done: 3, failed: 0, expired: 0, blocked: 0 });
});

test('a mid-run add waits for a genuinely free pass and never exceeds the cap', () => {
  let t = 0;
  const q = new JobQueue({ maxConcurrent: 1, maxAttempts: 1, now: () => t });
  q.add({ id: 'a', priority: 1, deps: [], durationMs: 5 });
  q.tick(); // a starts
  assert.deepEqual(q.stats(), { pending: 0, running: 1, done: 0, failed: 0, expired: 0, blocked: 0 });
  q.add({ id: 'urgent', priority: 100, deps: [], durationMs: 5 });
  assert.deepEqual(q.stats(), { pending: 1, running: 1, done: 0, failed: 0, expired: 0, blocked: 0 });
  t = 5;
  q.tick(); // a finishes; urgent starts only on the next pass
  assert.deepEqual(q.stats(), { pending: 1, running: 0, done: 1, failed: 0, expired: 0, blocked: 0 });
  q.tick(); // urgent starts
  assert.deepEqual(q.stats(), { pending: 0, running: 1, done: 1, failed: 0, expired: 0, blocked: 0 });
  t = 10;
  q.tick(); // urgent finishes
  assert.deepEqual(q.stats(), { pending: 0, running: 0, done: 2, failed: 0, expired: 0, blocked: 0 });
});
