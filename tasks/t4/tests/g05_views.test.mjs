import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Bus } from '../src/bus.js';
import { Scheduler } from '../src/scheduler.js';

const clock = () => {
  let t = 0;
  const fn = () => t;
  fn.advance = (n) => {
    t += n;
  };
  fn.get = () => t;
  return fn;
};

test('g05 stats counts all lifecycle states and snapshot reflects done timing', () => {
  const now = clock();
  const bus = new Bus();
  const sched = new Scheduler(bus, { now });
  assert.deepEqual(sched.stats(), { total: 0, pending: 0, running: 0, done: 0, cancelled: 0 });
  sched.schedule('p', 0);
  sched.schedule('r', 0);
  sched.schedule('d', 0);
  sched.schedule('c', 0);
  sched.start('r');
  now.advance(10);
  sched.start('d');
  now.advance(7);
  bus.emit('job:done', { id: 'd', atMs: 17 });
  sched.cancel('c');
  assert.deepEqual(sched.stats(), { total: 4, pending: 1, running: 1, done: 1, cancelled: 1 });
  assert.deepEqual(sched.snapshot().find((j) => j.id === 'd'), {
    id: 'd',
    runAtMs: 0,
    status: 'done',
    startedAt: 10,
    endedAt: 17,
    durationMs: 7,
  });
});

test('g05 snapshot returns a fresh array of fresh plain objects each call', () => {
  const bus = new Bus();
  const sched = new Scheduler(bus, { now: clock() });
  assert.deepEqual(sched.snapshot(), []);
  sched.schedule('a', 3);
  const snap1 = sched.snapshot();
  assert.equal(Array.isArray(snap1), true);
  assert.equal(snap1.length, 1);
  snap1[0].status = 'tampered';
  assert.equal(sched.snapshot()[0].status, 'pending');
  const snap2 = sched.snapshot();
  assert.notEqual(snap1, snap2);
  assert.notEqual(snap1[0], snap2[0]);
});

test('g05 rescheduled id after cancel replaces the record and runs a fresh lifecycle', () => {
  const bus = new Bus();
  const sched = new Scheduler(bus, { now: clock() });
  sched.schedule('a', 0);
  sched.cancel('a');
  sched.schedule('a', 5);
  sched.start('a');
  bus.emit('job:done', { id: 'a', atMs: 8 });
  const views = sched.snapshot();
  assert.equal(views.length, 1);
  assert.deepEqual(views[0], {
    id: 'a',
    runAtMs: 5,
    status: 'done',
    startedAt: 0,
    endedAt: 8,
    durationMs: 8,
  });
  assert.deepEqual(sched.stats(), { total: 1, pending: 0, running: 0, done: 1, cancelled: 0 });
});

test('g05 subscriber count returns to zero and a cancelled job among done jobs is intact', () => {
  const bus = new Bus();
  const sched = new Scheduler(bus, { now: clock() });
  for (let i = 0; i < 20; i++) {
    sched.schedule('j' + i, i);
    assert.equal(bus.listenerCount('job:done'), 1);
    sched.start('j' + i);
    bus.emit('job:done', { id: 'j' + i, atMs: i + 1 });
    assert.equal(bus.listenerCount('job:done'), 0);
  }
  assert.deepEqual(sched.stats(), { total: 20, pending: 0, running: 0, done: 20, cancelled: 0 });
  sched.schedule('keep1', 0);
  sched.schedule('kill', 0);
  sched.schedule('keep2', 0);
  sched.start('kill');
  sched.start('keep1');
  assert.equal(sched.cancel('kill'), true);
  bus.emit('job:done', { id: 'kill', atMs: 1 });
  bus.emit('job:done', { id: 'keep1', atMs: 2 });
  bus.emit('job:done', { id: 'keep2', atMs: 3 });
  assert.equal(sched.status('kill'), 'cancelled');
  assert.equal(sched.status('keep1'), 'done');
  assert.equal(sched.status('keep2'), 'done');
  assert.equal(bus.listenerCount('job:done'), 0);
  assert.deepEqual(sched.stats(), { total: 23, pending: 0, running: 0, done: 22, cancelled: 1 });
});

test('g05 scheduler works with the default now (Date.now) without asserting on time', () => {
  const bus = new Bus();
  const sched = new Scheduler(bus);
  sched.schedule('a', 0);
  assert.equal(sched.start('a'), true);
  bus.emit('job:done', { id: 'a', atMs: 5 });
  const view = sched.snapshot().find((j) => j.id === 'a');
  assert.equal(view.status, 'done');
  assert.equal(view.endedAt, 5);
  assert.equal(typeof view.startedAt, 'number');
  assert.equal(view.durationMs, 5 - view.startedAt);
  assert.equal(bus.listenerCount('job:done'), 0);
});