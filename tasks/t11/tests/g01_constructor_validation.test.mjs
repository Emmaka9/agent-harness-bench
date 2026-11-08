import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JobQueue } from '../src/queue.js';

const MC_MSG = 'maxConcurrent must be an integer >= 1';
const MA_MSG = 'maxAttempts must be an integer >= 1';
const NOW_MSG = 'now must be a function';

test('constructor validates maxConcurrent, then maxAttempts, then now with exact TypeErrors', () => {
  for (const maxConcurrent of [0, -1, -100, 1.5, NaN, Infinity, '2', null, undefined]) {
    assert.throws(
      () => new JobQueue({ maxConcurrent, maxAttempts: 3, now: () => 0 }),
      (err) => err instanceof TypeError && err.message === MC_MSG,
      `maxConcurrent=${String(maxConcurrent)}`
    );
  }
  for (const maxAttempts of [0, -3, 2.5, NaN, Infinity, '3', null, undefined]) {
    assert.throws(
      () => new JobQueue({ maxConcurrent: 2, maxAttempts, now: () => 0 }),
      (err) => err instanceof TypeError && err.message === MA_MSG,
      `maxAttempts=${String(maxAttempts)}`
    );
  }
  for (const now of [42, 'x', null, true, undefined]) {
    assert.throws(
      () => new JobQueue({ maxConcurrent: 2, maxAttempts: 3, now }),
      (err) => err instanceof TypeError && err.message === NOW_MSG,
      `now=${String(now)}`
    );
  }
  // order: maxConcurrent is validated first, then maxAttempts, then now
  assert.throws(
    () => new JobQueue({ maxConcurrent: 0, maxAttempts: 0, now: 42 }),
    (err) => err instanceof TypeError && err.message === MC_MSG
  );
  assert.throws(
    () => new JobQueue({ maxConcurrent: 1, maxAttempts: 0, now: 42 }),
    (err) => err instanceof TypeError && err.message === MA_MSG
  );
  // no-arg construction reports the first message too
  assert.throws(
    () => new JobQueue(),
    (err) => err instanceof TypeError && err.message === MC_MSG
  );
  // valid construction succeeds and never reads the clock
  let calls = 0;
  const q = new JobQueue({ maxConcurrent: 1, maxAttempts: 1, now: () => { calls++; return 0; } });
  assert.equal(q instanceof JobQueue, true);
  assert.equal(calls, 0, 'the constructor must not read the clock');
});
