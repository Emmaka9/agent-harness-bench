import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Bus } from '../src/bus.js';
import { Scheduler } from '../src/scheduler.js';

const tick = () => {
  let t = 0;
  const fn = () => t;
  fn.advance = (n) => {
    t += n;
  };
  return fn;
};

test('schedule stores a pending job and counts exactly one subscriber per job', () => {
  const bus = new Bus();
  const sched = new Scheduler(bus);
  const view = sched.schedule('a', 10);
  assert.deepEqual(view, {
    id: 'a',
    runAtMs: 10,
    status: 'pending',
    startedAt: null,
    endedAt: null,
    durationMs: null,
  });
  assert.equal(bus.listenerCount('job:done'), 1);
  sched.schedule('b', 20);
  assert.equal(bus.listenerCount('job:done'), 2);
});

test('done handler fires once and unsubscribes', () => {
  const bus = new Bus();
  const sched = new Scheduler(bus);
  sched.schedule('a', 0);
  assert.equal(bus.listenerCount('job:done'), 1);
  assert.equal(sched.start('a'), true);
  bus.emit('job:done', { id: 'a', atMs: 5 });
  assert.equal(sched.status('a'), 'done');
  assert.equal(bus.listenerCount('job:done'), 0);
});

test('cancel on a running job unsubscribes so a later done is ignored', () => {
  const bus = new Bus();
  const sched = new Scheduler(bus, { now: tick() });
  sched.schedule('a', 0);
  sched.start('a');
  assert.equal(sched.cancel('a'), true);
  assert.equal(sched.status('a'), 'cancelled');
  assert.equal(bus.listenerCount('job:done'), 0);
  bus.emit('job:done', { id: 'a', atMs: 99 });
  assert.equal(sched.status('a'), 'cancelled');
});

test('cancel on a never-started pending job also unsubscribes', () => {
  const bus = new Bus();
  const sched = new Scheduler(bus, { now: tick() });
  sched.schedule('a', 0);
  assert.equal(sched.cancel('a'), true);
  assert.equal(bus.listenerCount('job:done'), 0);
  bus.emit('job:done', { id: 'a', atMs: 99 });
  assert.equal(sched.status('a'), 'cancelled');
});

test('cancel returns false for unknown or terminal jobs and keeps subscriber counts', () => {
  const bus = new Bus();
  const sched = new Scheduler(bus, { now: tick() });
  assert.equal(sched.cancel('ghost'), false);
  sched.schedule('a', 0);
  sched.cancel('a');
  assert.equal(sched.cancel('a'), false);
  sched.schedule('b', 0);
  sched.start('b');
  bus.emit('job:done', { id: 'b', atMs: 1 });
  assert.equal(sched.cancel('b'), false);
});

test('duplicate ids and invalid arguments throw', () => {
  const bus = new Bus();
  const sched = new Scheduler(bus);
  sched.schedule('a', 0);
  assert.throws(() => sched.schedule('a', 1), /duplicate job id/);
  assert.throws(() => sched.schedule('', 1), TypeError);
  assert.throws(() => sched.schedule('b', Infinity), TypeError);
  assert.throws(() => new Scheduler(bus, { now: 'nope' }), TypeError);
  assert.throws(() => new Scheduler('not-a-bus'), TypeError);
});

test('stats and snapshot reflect lifecycle', () => {
  const bus = new Bus();
  const now = tick();
  const sched = new Scheduler(bus, { now });
  sched.schedule('a', 0);
  sched.schedule('b', 0);
  now.advance(3);
  sched.start('a');
  now.advance(1);
  bus.emit('job:done', { id: 'a', atMs: 4 });
  sched.cancel('b');
  assert.deepEqual(sched.stats(), { total: 2, pending: 0, running: 0, done: 1, cancelled: 1 });
  const snap = sched.snapshot();
  assert.equal(snap.length, 2);
  assert.deepEqual(sched.snapshot().find((j) => j.id === 'b'), {
    id: 'b',
    runAtMs: 0,
    status: 'cancelled',
    startedAt: null,
    endedAt: 4,
    durationMs: null,
  });
});
