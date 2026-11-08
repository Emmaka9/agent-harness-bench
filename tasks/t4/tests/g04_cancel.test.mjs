import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Bus } from '../src/bus.js';
import { Scheduler } from '../src/scheduler.js';

const clock = () => {
  let t = 0;
  let calls = 0;
  const fn = () => {
    calls++;
    return t;
  };
  fn.advance = (n) => {
    t += n;
  };
  fn.get = () => t;
  fn.calls = () => calls;
  return fn;
};

test('g04 cancel of a running job unsubscribes and stamps endedAt from now', () => {
  const now = clock();
  const bus = new Bus();
  const sched = new Scheduler(bus, { now });
  sched.schedule('a', 0);
  now.advance(4);
  sched.start('a');
  now.advance(3);
  assert.equal(sched.cancel('a'), true);
  assert.equal(bus.listenerCount('job:done'), 0);
  assert.deepEqual(sched.snapshot().find((j) => j.id === 'a'), {
    id: 'a',
    runAtMs: 0,
    status: 'cancelled',
    startedAt: 4,
    endedAt: 7,
    durationMs: null,
  });
});

test('g04 cancel of a never-started pending job also unsubscribes', () => {
  const now = clock();
  const bus = new Bus();
  const sched = new Scheduler(bus, { now });
  now.advance(2);
  sched.schedule('a', 0);
  now.advance(5);
  assert.equal(sched.cancel('a'), true);
  assert.equal(bus.listenerCount('job:done'), 0);
  assert.deepEqual(sched.snapshot().find((j) => j.id === 'a'), {
    id: 'a',
    runAtMs: 0,
    status: 'cancelled',
    startedAt: null,
    endedAt: 7,
    durationMs: null,
  });
});

test('g04 a later done emit after cancel is a no-op in both cancel paths', () => {
  const now = clock();
  const bus = new Bus();
  const sched = new Scheduler(bus, { now });
  sched.schedule('r', 0);
  sched.start('r');
  sched.cancel('r');
  now.advance(50);
  bus.emit('job:done', { id: 'r', atMs: 999 });
  assert.deepEqual(sched.snapshot().find((j) => j.id === 'r'), {
    id: 'r',
    runAtMs: 0,
    status: 'cancelled',
    startedAt: 0,
    endedAt: 0,
    durationMs: null,
  });
  assert.equal(bus.listenerCount('job:done'), 0);
  sched.schedule('p', 0);
  sched.cancel('p');
  bus.emit('job:done', { id: 'p', atMs: 999 });
  assert.deepEqual(sched.snapshot().find((j) => j.id === 'p'), {
    id: 'p',
    runAtMs: 0,
    status: 'cancelled',
    startedAt: null,
    endedAt: 50,
    durationMs: null,
  });
  assert.equal(bus.listenerCount('job:done'), 0);
  assert.equal(now.get(), 50);
  assert.equal(now.calls(), 3);
});

test('g04 cancel returns false for unknown and terminal jobs without side effects', () => {
  const now = clock();
  const bus = new Bus();
  const sched = new Scheduler(bus, { now });
  assert.equal(sched.cancel('ghost'), false);
  assert.equal(now.calls(), 0);
  sched.schedule('d', 0);
  sched.start('d');
  bus.emit('job:done', { id: 'd', atMs: 2 });
  assert.equal(sched.cancel('d'), false);
  sched.schedule('c', 0);
  assert.equal(sched.cancel('c'), true);
  assert.equal(sched.cancel('c'), false);
  assert.equal(now.calls(), 2);
  assert.deepEqual(sched.stats(), { total: 2, pending: 0, running: 0, done: 1, cancelled: 1 });
});
