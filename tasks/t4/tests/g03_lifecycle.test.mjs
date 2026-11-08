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

test('g03 start transitions only pending jobs and stamps startedAt with now', () => {
  const now = clock();
  const sched = new Scheduler(new Bus(), { now });
  sched.schedule('a', 0);
  now.advance(5);
  assert.equal(sched.start('a'), true);
  now.advance(2);
  assert.equal(sched.start('a'), false);
  assert.equal(sched.status('a'), 'running');
  const view = sched.snapshot().find((j) => j.id === 'a');
  assert.equal(view.startedAt, 5);
  assert.equal(view.status, 'running');
});

test('g03 start on unknown, done or cancelled jobs returns false with no now call', () => {
  const now = clock();
  const bus = new Bus();
  const sched = new Scheduler(bus, { now });
  assert.equal(sched.start('ghost'), false);
  assert.equal(now.calls(), 0);
  sched.schedule('d', 0);
  sched.start('d');
  bus.emit('job:done', { id: 'd', atMs: 1 });
  assert.equal(sched.start('d'), false);
  sched.schedule('c', 0);
  assert.equal(now.calls(), 1);
  sched.cancel('c');
  assert.equal(sched.start('c'), false);
  assert.equal(now.calls(), 2);
  const view = sched.snapshot().find((j) => j.id === 'd');
  assert.equal(view.endedAt, 1);
  assert.equal(view.durationMs, 1);
  assert.equal(sched.status('d'), 'done');
  assert.equal(bus.listenerCount('job:done'), 0);
  assert.deepEqual(sched.stats(), { total: 2, pending: 0, running: 0, done: 1, cancelled: 1 });
});

test('g03 done uses now when atMs is not finite; done on a pending job leaves nulls', () => {
  const now = clock();
  const bus = new Bus();
  const sched = new Scheduler(bus, { now });
  now.advance(7);
  sched.schedule('a', 0);
  now.advance(3);
  sched.start('a');
  now.advance(4);
  bus.emit('job:done', { id: 'a' });
  assert.deepEqual(sched.snapshot().find((j) => j.id === 'a'), {
    id: 'a',
    runAtMs: 0,
    status: 'done',
    startedAt: 10,
    endedAt: 14,
    durationMs: 4,
  });
  bus.emit('job:done', { id: 'a', atMs: 'x' });
  bus.emit('job:done', { id: 'a', atMs: NaN });
  bus.emit('job:done', { id: 'a', atMs: 999 });
  assert.equal(sched.snapshot().find((j) => j.id === 'a').endedAt, 14);
  assert.equal(now.calls(), 2);
  sched.schedule('p', 0);
  bus.emit('job:done', { id: 'p', atMs: 9 });
  assert.deepEqual(sched.snapshot().find((j) => j.id === 'p'), {
    id: 'p',
    runAtMs: 0,
    status: 'done',
    startedAt: null,
    endedAt: 9,
    durationMs: null,
  });
});

test('g03 done events for other ids, non-object payloads and terminal jobs affect nothing', () => {
  const bus = new Bus();
  const sched = new Scheduler(bus, { now: clock() });
  sched.schedule('a', 0);
  bus.emit('job:done', { id: 'b', atMs: 1 });
  bus.emit('job:done', undefined);
  bus.emit('job:done', null);
  bus.emit('job:done', 42);
  bus.emit('job:done', { atMs: 1 });
  assert.equal(sched.status('a'), 'pending');
  assert.equal(bus.listenerCount('job:done'), 1);
  bus.emit('job:done', { id: 'a', atMs: 5 });
  bus.emit('job:done', { id: 'a', atMs: 6 });
  assert.equal(sched.status('a'), 'done');
  assert.equal(sched.snapshot().find((j) => j.id === 'a').endedAt, 5);
  assert.equal(bus.listenerCount('job:done'), 0);
});
