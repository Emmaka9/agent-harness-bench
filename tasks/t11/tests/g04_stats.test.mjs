import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JobQueue } from '../src/queue.js';

test('stats returns exactly the six keys, fresh each call, and mutating the result is harmless', () => {
  let t = 0;
  const q = new JobQueue({ maxConcurrent: 2, maxAttempts: 2, now: () => t });
  assert.deepEqual(q.stats(), { pending: 0, running: 0, done: 0, failed: 0, expired: 0, blocked: 0 });

  q.add({ id: 'a', priority: 1, deps: [], durationMs: 5 });
  q.tick();
  const s1 = q.stats();
  assert.deepEqual(Object.keys(s1).sort(), ['blocked', 'done', 'expired', 'failed', 'pending', 'running']);
  assert.deepEqual(s1, { pending: 0, running: 1, done: 0, failed: 0, expired: 0, blocked: 0 });

  // the returned object is a fresh plain object: mutating it must not leak
  s1.running = 99;
  s1.done = 99;
  s1.bogus = 1;
  const s2 = q.stats();
  assert.deepEqual(s2, { pending: 0, running: 1, done: 0, failed: 0, expired: 0, blocked: 0 });
  assert.equal('bogus' in s2, false);
  assert.notEqual(s1, s2);

  t = 5;
  q.tick();
  assert.deepEqual(q.stats(), { pending: 0, running: 0, done: 1, failed: 0, expired: 0, blocked: 0 });
});
