import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeIntervals, findFreeSlots } from '../src/calendar.js';

// Fixed epoch fixtures instead of a real clock: no Date.now dependence anywhere.
const MIN = 60000;
const NINE = Date.UTC(2024, 0, 1) + 9 * 3600000; // fixed epoch, deterministic

test('a calendar morning: touching meetings merge and qualifying slots come out in order', () => {
  const out = findFreeSlots(
    [
      { start: NINE + 30 * MIN, end: NINE + 60 * MIN, label: 'sync' },
      { start: NINE, end: NINE + 30 * MIN, label: 'standup' }, // touches the sync
      { start: NINE + 120 * MIN, end: NINE + 180 * MIN, label: 'review' },
    ],
    { start: NINE, end: NINE + 240 * MIN },
    15 * MIN
  );
  assert.deepEqual(out, [
    { start: NINE + 60 * MIN, end: NINE + 120 * MIN },
    { start: NINE + 180 * MIN, end: NINE + 240 * MIN },
  ]);
});

test('booking a found slot with a touching interval removes it on recompute', () => {
  const w = { start: NINE, end: NINE + 60 * MIN };
  const iv = [{ start: NINE + 20 * MIN, end: NINE + 30 * MIN }];
  const free = findFreeSlots(iv, w, 10 * MIN);
  assert.equal(free.length, 2);
  const booked = [...iv, { start: free[0].start, end: free[0].end }];
  assert.deepEqual(findFreeSlots(booked, w, 10 * MIN), [free[1]]);
  assert.deepEqual(mergeIntervals(booked), [{ start: NINE, end: NINE + 30 * MIN }]);
  // Omitted opts and empty opts behave the same on the composed path.
  assert.deepEqual(findFreeSlots([], w, 5 * MIN), [{ start: w.start, end: w.end }]);
  assert.deepEqual(findFreeSlots([], w, 5 * MIN, {}), [{ start: w.start, end: w.end }]);
});

test('offsets map a UTC window onto local busy time and shift earlier across zero', () => {
  // Window expressed in UTC; the local zone is UTC+90min, so busy time recorded
  // in local epochs matches once the window is shifted by +90min.
  const localNine = NINE + 90 * MIN;
  const out = findFreeSlots(
    [{ start: localNine, end: localNine + 10 * MIN, label: 'breakfast' }],
    { start: NINE, end: NINE + 60 * MIN },
    10 * MIN,
    { offsetMin: 90 }
  );
  assert.deepEqual(out, [{ start: localNine + 10 * MIN, end: NINE + 60 * MIN + 90 * MIN }]);
  // Negative offset: effective window is [1000 - 60000, 2000 - 60000] = [-59000, -58000].
  const w = { start: 1000, end: 2000 };
  const out2 = findFreeSlots([{ start: -60000, end: -58500 }], w, 100, { offsetMin: -1 });
  assert.deepEqual(out2, [{ start: -58500, end: -58000 }]);
  assert.deepEqual(findFreeSlots([], w, 1, { offsetMin: -1 }), [
    { start: -59000, end: -58000 },
  ]);
  // The reverse direction: a negative window shifted to the positives.
  assert.deepEqual(
    findFreeSlots([], { start: -60000, end: -59000 }, 1, { offsetMin: 1 }),
    [{ start: 0, end: 1000 }]
  );
  assert.deepEqual(findFreeSlots([], { start: 0, end: 10 }, 5, {}), [{ start: 0, end: 10 }]);
});

test('a dense mixed scenario: duplicates, containment, touching, and gaps', () => {
  const iv = [
    { start: 300, end: 400, label: 'x' },
    { start: 300, end: 400, label: 'x' }, // exact duplicate
    { start: 350, end: 380, label: 'contained' }, // inside the first
    { start: 400, end: 450, label: 'touching' }, // touches the first
    { start: 600, end: 650 }, // separate block, no label
  ];
  const merged = mergeIntervals(iv);
  assert.deepEqual(merged, [
    { start: 300, end: 450, label: 'x' },
    { start: 600, end: 650 },
  ]);
  assert.equal('label' in merged[1], false);
  assert.deepEqual(findFreeSlots(iv, { start: 250, end: 700 }, 50), [
    { start: 250, end: 300 },
    { start: 450, end: 600 },
    { start: 650, end: 700 },
  ]);
});

test('offset combined with busy time at the shifted edges clips and filters correctly', () => {
  // Window [0,100] shifted +1min -> [60000, 60100]; busy [59000, 60050]
  // clips to [60000, 60050] leaving one exact-boundary 50ms gap.
  const opts = { offsetMin: 1 };
  assert.deepEqual(
    findFreeSlots([{ start: 59000, end: 60050 }], { start: 0, end: 100 }, 50, opts),
    [{ start: 60050, end: 60100 }]
  );
  assert.deepEqual(
    findFreeSlots([{ start: 59000, end: 60050 }], { start: 0, end: 100 }, 51, opts),
    []
  );
  // Fractional minutes: offset 0.5min shifts window [0,50000] to [30000, 80000].
  assert.deepEqual(
    findFreeSlots([{ start: 30000, end: 40000 }], { start: 0, end: 50000 }, 1, {
      offsetMin: 0.5,
    }),
    [{ start: 40000, end: 80000 }]
  );
  // And the composed path again with both functions on one dense input.
  const iv = [
    { start: 300, end: 450, label: 'x' },
    { start: 600, end: 650 },
  ];
  assert.deepEqual(mergeIntervals([
    { start: 300, end: 400, label: 'x' },
    { start: 350, end: 380, label: 'contained' },
    { start: 400, end: 450, label: 'touching' },
    { start: 600, end: 650 },
  ]), iv);
});
