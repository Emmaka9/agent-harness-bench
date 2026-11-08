import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JobQueue } from '../src/queue.js';

test('add validates the job shape in the order id, priority, deps, durationMs, deadlineMs', () => {
  const q = new JobQueue({ maxConcurrent: 1, maxAttempts: 1, now: () => 0 });
  const cases = [
    [{}, 'job.id must be a non-empty string'],
    [{ id: '' }, 'job.id must be a non-empty string'],
    [{ id: 7 }, 'job.id must be a non-empty string'],
    [{ id: 'a' }, 'job.priority must be a finite number'],
    [{ id: 'a', priority: NaN }, 'job.priority must be a finite number'],
    [{ id: 'a', priority: Infinity }, 'job.priority must be a finite number'],
    [{ id: 'a', priority: 1 }, 'job.deps must be an array'],
    [{ id: 'a', priority: 1, deps: 'x' }, 'job.deps must be an array'],
    [{ id: 'a', priority: 1, deps: [] }, 'job.durationMs must be a finite number >= 0'],
    [{ id: 'a', priority: 1, deps: [], durationMs: -1 }, 'job.durationMs must be a finite number >= 0'],
    [{ id: 'a', priority: 1, deps: [], durationMs: NaN }, 'job.durationMs must be a finite number >= 0'],
    [{ id: 'a', priority: 1, deps: [], durationMs: 5, deadlineMs: 'x' }, 'job.deadlineMs must be a finite number'],
    [{ id: 'a', priority: 1, deps: [], durationMs: 5, deadlineMs: NaN }, 'job.deadlineMs must be a finite number'],
  ];
  for (const [job, msg] of cases) {
    assert.throws(
      () => q.add(job),
      (err) => err instanceof TypeError && err.message === msg,
      msg
    );
  }
  // a fully valid job with optional deadlineMs omitted returns the id
  assert.equal(q.add({ id: 'ok', priority: 0, deps: [], durationMs: 1 }), 'ok');
  // deadlineMs explicitly undefined is fine
  assert.equal(q.add({ id: 'ok2', priority: 0, deps: [], durationMs: 0, deadlineMs: undefined }), 'ok2');
  // shape validation fires even for an id that is already added
  assert.throws(
    () => q.add({ id: 'ok' }),
    (err) => err instanceof TypeError && err.message === 'job.priority must be a finite number'
  );
});
