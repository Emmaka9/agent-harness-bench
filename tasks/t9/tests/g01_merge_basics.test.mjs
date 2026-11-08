import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeIntervals } from '../src/calendar.js';

test('empty input merges to an empty array; a single unlabeled interval stays unlabeled', () => {
  assert.deepEqual(mergeIntervals([]), []);
  const out = mergeIntervals([{ start: 5, end: 6 }]);
  assert.deepEqual(out, [{ start: 5, end: 6 }]);
  assert.equal('label' in out[0], false, 'absent label key, not label: undefined');
  assert.deepEqual(
    mergeIntervals([{ start: 1000, end: 2000, label: 'standup' }]),
    [{ start: 1000, end: 2000, label: 'standup' }]
  );
});

test('overlapping intervals merge; disjoint ones stay separate and come out sorted by start', () => {
  assert.deepEqual(
    mergeIntervals([
      { start: 100, end: 300 },
      { start: 200, end: 500 },
    ]),
    [{ start: 100, end: 500 }]
  );
  assert.deepEqual(
    mergeIntervals([
      { start: 500, end: 600, label: 'late' },
      { start: 0, end: 100, label: 'early' },
      { start: 200, end: 300, label: 'mid' },
    ]),
    [
      { start: 0, end: 100, label: 'early' },
      { start: 200, end: 300, label: 'mid' },
      { start: 500, end: 600, label: 'late' },
    ]
  );
});

test('exactly touching intervals merge (end === next start)', () => {
  const out = mergeIntervals([
    { start: 0, end: 100, label: 'a' },
    { start: 100, end: 200, label: 'b' },
    { start: 200, end: 300, label: 'c' },
  ]);
  assert.deepEqual(out, [{ start: 0, end: 300, label: 'a' }]);
  assert.deepEqual(
    mergeIntervals([
      { start: 500, end: 600 },
      { start: 0, end: 100 },
      { start: 100, end: 500, label: 'bridge' },
    ]),
    [{ start: 0, end: 600 }],
    'a middle bridge interval unifies all three, but the earliest source is unlabeled'
  );
  assert.deepEqual(
    mergeIntervals([
      { start: 0, end: 100, label: 'first' },
      { start: 100, end: 500, label: 'bridge' },
      { start: 500, end: 600 },
    ]),
    [{ start: 0, end: 600, label: 'first' }],
    'the earliest-starting source owns the label even when a later source is unlabeled'
  );
});

test('a merged run keeps the label of its earlier-starting interval, ties broken by input order', () => {
  assert.deepEqual(
    mergeIntervals([
      { start: 200, end: 400, label: 'later' },
      { start: 100, end: 300, label: 'earlier' },
    ]),
    [{ start: 100, end: 400, label: 'earlier' }]
  );
  assert.deepEqual(
    mergeIntervals([
      { start: 10, end: 20, label: 'first-in-input' },
      { start: 10, end: 30, label: 'second-in-input' },
    ]),
    [{ start: 10, end: 30, label: 'first-in-input' }]
  );
  // An unlabeled earliest-starting source leaves the merged run unlabeled.
  const out = mergeIntervals([
    { start: 0, end: 50 },
    { start: 40, end: 60, label: 'other' },
  ]);
  assert.deepEqual(out, [{ start: 0, end: 60 }]);
  assert.equal('label' in out[0], false);
});

test('duplicate intervals collapse to a single interval', () => {
  assert.deepEqual(
    mergeIntervals([
      { start: 5, end: 10, label: 'dup' },
      { start: 5, end: 10, label: 'dup' },
      { start: 5, end: 10, label: 'dup' },
    ]),
    [{ start: 5, end: 10, label: 'dup' }]
  );
  // Duplicates of an unlabeled interval stay unlabeled after the collapse.
  const out = mergeIntervals([
    { start: 1, end: 2 },
    { start: 1, end: 2 },
  ]);
  assert.deepEqual(out, [{ start: 1, end: 2 }]);
  assert.equal('label' in out[0], false);
});
