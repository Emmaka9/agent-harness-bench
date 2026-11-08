import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JobQueue } from '../src/queue.js';

test('empty tick is a no-op, returns undefined, and reads the clock exactly once per pass', () => {
  let t = 0;
  let reads = 0;
  const q = new JobQueue({ maxConcurrent: 2, maxAttempts: 3, now: () => { reads++; return t; } });
  assert.deepEqual(q.stats(), { pending: 0, running: 0, done: 0, failed: 0, expired: 0, blocked: 0 });
  const before = reads;
  assert.equal(q.tick(), undefined);
  assert.equal(q.tick(), undefined);
  assert.equal(reads, before + 2, 'each empty pass reads the clock exactly once');
  assert.deepEqual(q.stats(), { pending: 0, running: 0, done: 0, failed: 0, expired: 0, blocked: 0 });
  t = 10_000;
  assert.equal(q.tick(), undefined);
  assert.deepEqual(q.stats(), { pending: 0, running: 0, done: 0, failed: 0, expired: 0, blocked: 0 });
});
