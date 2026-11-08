import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Bus } from '../src/bus.js';
import { Scheduler } from '../src/scheduler.js';

const makeBus = () => new Bus();

test('g02 constructor validates bus then now', () => {
  const bus = makeBus();
  assert.throws(() => new Scheduler('nope'), TypeError);
  assert.throws(() => new Scheduler(null), TypeError);
  assert.throws(() => new Scheduler(bus, { now: 'nope' }), TypeError);
  assert.throws(() => new Scheduler(bus, { now: 42 }), TypeError);
  assert.equal(typeof new Scheduler(bus).schedule, 'function');
  assert.equal(typeof new Scheduler(bus, { now: () => 0 }).schedule, 'function');
});

test('g02 schedule returns the exact view shape and creates one subscription per job', () => {
  const bus = makeBus();
  const sched = new Scheduler(bus, { now: () => 0 });
  assert.deepEqual(sched.schedule('a', 10), {
    id: 'a',
    runAtMs: 10,
    status: 'pending',
    startedAt: null,
    endedAt: null,
    durationMs: null,
  });
  assert.equal(bus.listenerCount('job:done'), 1);
  assert.deepEqual(sched.schedule('b', -1), {
    id: 'b',
    runAtMs: -1,
    status: 'pending',
    startedAt: null,
    endedAt: null,
    durationMs: null,
  });
  assert.equal(bus.listenerCount('job:done'), 2);
});

test('g02 schedule validates id first then runAtMs, and rejects duplicate non-terminal ids', () => {
  const sched = new Scheduler(makeBus(), { now: () => 0 });
  assert.throws(() => sched.schedule('', 1), TypeError);
  assert.throws(() => sched.schedule(7, 1), TypeError);
  assert.throws(() => sched.schedule('x', 'soon'), TypeError);
  assert.throws(() => sched.schedule('x', NaN), TypeError);
  assert.throws(() => sched.schedule('x', Infinity), TypeError);
  sched.schedule('x', 0);
  assert.equal(sched.status('x'), 'pending');
  assert.throws(() => sched.schedule('x', 5), (err) => err instanceof Error && err.message === 'duplicate job id');
  assert.equal(sched.status('x'), 'pending');
});

test('g02 an id whose job is terminal may be scheduled again and replaces it', () => {
  const bus = makeBus();
  const sched = new Scheduler(bus, { now: () => 0 });
  sched.schedule('a', 0);
  sched.cancel('a');
  assert.equal(bus.listenerCount('job:done'), 0);
  sched.schedule('a', 5);
  assert.equal(bus.listenerCount('job:done'), 1);
  assert.equal(sched.status('a'), 'pending');
  assert.deepEqual(sched.snapshot(), [
    { id: 'a', runAtMs: 5, status: 'pending', startedAt: null, endedAt: null, durationMs: null },
  ]);
  const bus2 = makeBus();
  const sched2 = new Scheduler(bus2, { now: () => 0 });
  sched2.schedule('b', 0);
  sched2.start('b');
  bus2.emit('job:done', { id: 'b', atMs: 3 });
  assert.equal(bus2.listenerCount('job:done'), 0);
  sched2.schedule('b', 9);
  assert.equal(sched2.status('b'), 'pending');
  assert.equal(bus2.listenerCount('job:done'), 1);
  assert.deepEqual(sched2.snapshot(), [
    { id: 'b', runAtMs: 9, status: 'pending', startedAt: null, endedAt: null, durationMs: null },
  ]);
});
