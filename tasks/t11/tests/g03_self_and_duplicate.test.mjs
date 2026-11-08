import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JobQueue } from '../src/queue.js';

test('add rejects self dependency before duplicates, and duplicate for any existing id', () => {
  const clock = { t: 0 };
  const q = new JobQueue({ maxConcurrent: 4, maxAttempts: 1, now: () => clock.t });

  // self dependency is an Error (not TypeError), checked after shape validation
  assert.throws(
    () => q.add({ id: 's', priority: 0, deps: ['s'], durationMs: 1 }),
    (err) => err instanceof Error && !(err instanceof TypeError) && err.message === 'self dependency: s'
  );
  // shape errors still take precedence over the self-dependency check
  assert.throws(
    () => q.add({ id: 's', priority: 0, deps: ['s'] }),
    (err) => err instanceof TypeError && err.message === 'job.durationMs must be a finite number >= 0'
  );

  q.add({ id: 'j', priority: 0, deps: [], durationMs: 0 });
  // duplicate while pending
  assert.throws(
    () => q.add({ id: 'j', priority: 9, deps: [], durationMs: 2 }),
    (err) => err instanceof Error && !(err instanceof TypeError) && err.message === 'duplicate job: j'
  );
  q.tick(); // j (durationMs 0) starts and finishes within the pass: done
  assert.equal(q.stats().done, 1);
  // duplicate is still rejected for a terminal (done) id
  assert.throws(
    () => q.add({ id: 'j', priority: 9, deps: [], durationMs: 2 }),
    (err) => err.message === 'duplicate job: j'
  );
  // duplicate check comes after the self-dependency check for the same job
  assert.throws(
    () => q.add({ id: 'j', priority: 9, deps: ['j'], durationMs: 2 }),
    (err) => err.message === 'self dependency: j'
  );
  clock.t = 100;
  q.tick();
  assert.equal(q.stats().done, 1);
});
