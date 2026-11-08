import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeIntervals, findFreeSlots } from '../src/calendar.js';

const MSG = 'invalid interval: start must be < end';
const NOW_MSG = 'now must be a function or undefined';
const OFF_MSG = 'offsetMin must be a finite number';

test('validation is per interval, in input order: reversed or equal start/end throw TypeError', () => {
  assert.throws(
    () =>
      mergeIntervals([
        { start: 0, end: 10 },
        { start: 20, end: 5 },
      ]),
    { name: 'TypeError', message: MSG }
  );
  assert.throws(() => mergeIntervals([{ start: 7, end: 7 }]), { message: MSG });
  assert.throws(
    () => findFreeSlots([{ start: 100, end: 50 }], { start: 0, end: 1000 }, 10),
    { name: 'TypeError', message: MSG }
  );
  // A valid interval before the bad one does not suppress the throw.
  assert.throws(
    () =>
      mergeIntervals([
        { start: 0, end: 10 },
        { start: 10, end: 20 },
        { start: 100, end: 99 },
      ]),
    { message: MSG }
  );
});

test('opts.now must be a function or undefined, in both functions', () => {
  for (const bad of [42, 'x', null, true]) {
    assert.throws(() => mergeIntervals([], { now: bad }), { message: NOW_MSG });
    assert.throws(
      () => findFreeSlots([], { start: 0, end: 100 }, 1, { now: bad }),
      { message: NOW_MSG }
    );
  }
  assert.doesNotThrow(() => mergeIntervals([], { now: () => 0 }));
  assert.doesNotThrow(() => mergeIntervals([], undefined));
  assert.doesNotThrow(() => mergeIntervals([], {}));
});

test('offsetMin must be a finite number; option checks run before interval checks', () => {
  for (const bad of [NaN, Infinity, -Infinity, null, true, '5']) {
    assert.throws(
      () => findFreeSlots([], { start: 0, end: 100 }, 1, { offsetMin: bad }),
      { message: OFF_MSG },
      `offsetMin=${String(bad)}`
    );
  }
  assert.doesNotThrow(() => findFreeSlots([], { start: 0, end: 100 }, 1, { offsetMin: 0.5 }));
  const badIntervals = [{ start: 10, end: 5 }];
  assert.throws(
    () => findFreeSlots(badIntervals, { start: 0, end: 100 }, 1, { now: 42 }),
    { message: NOW_MSG },
    'bad now wins over bad intervals'
  );
  assert.throws(
    () =>
      findFreeSlots(badIntervals, { start: 0, end: 100 }, 1, {
        now: () => 0,
        offsetMin: 'x',
      }),
    { message: OFF_MSG },
    'bad offsetMin wins over bad intervals'
  );
  assert.throws(
    () =>
      findFreeSlots(badIntervals, { start: 0, end: 100 }, 1, {
        now: () => 0,
        offsetMin: 5,
      }),
    { message: MSG },
    'valid options fall through to interval validation'
  );
});

test('inputs are never mutated, results are fresh objects, and no extra properties are copied', () => {
  const intervals = [
    { start: 300, end: 400, label: 'b' },
    { start: 0, end: 350, label: 'a' },
  ];
  const snapshot = JSON.stringify(intervals);
  const window = { start: 0, end: 1000 };
  mergeIntervals(intervals);
  findFreeSlots(intervals, window, 10, { offsetMin: 5 });
  assert.equal(JSON.stringify(intervals), snapshot, 'intervals untouched');
  assert.deepEqual(window, { start: 0, end: 1000 }, 'window untouched');

  const first = mergeIntervals(intervals);
  first[0].end = 99999;
  assert.deepEqual(mergeIntervals(intervals), [{ start: 0, end: 400, label: 'a' }]);

  const extra = mergeIntervals([{ start: 0, end: 10, label: 'x', note: 'ignore me' }]);
  assert.deepEqual(extra, [{ start: 0, end: 10, label: 'x' }]);
  assert.deepEqual(Object.keys(extra[0]).sort(), ['end', 'label', 'start']);
});
