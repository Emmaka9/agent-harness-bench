import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findFreeSlots } from '../src/calendar.js';

test('empty interval set: the whole window is the single free slot (degenerate window too)', () => {
  assert.deepEqual(findFreeSlots([], { start: 0, end: 100 }, 1), [
    { start: 0, end: 100 },
  ]);
  assert.deepEqual(findFreeSlots([], { start: 5, end: 5 }, 0), []);
  assert.deepEqual(findFreeSlots([], { start: 5, end: 5 }, 1), []);
});

test('an interval outside the window leaves one full-window slot; one inside splits the window', () => {
  assert.deepEqual(
    findFreeSlots([{ start: 200, end: 300 }], { start: 0, end: 100 }, 1),
    [{ start: 0, end: 100 }]
  );
  assert.deepEqual(
    findFreeSlots([{ start: 300, end: 400 }], { start: 0, end: 1000 }, 10),
    [
      { start: 0, end: 300 },
      { start: 400, end: 1000 },
    ]
  );
});

test('touching merged blocks leave no gap between them; clipped and covered windows leave nothing', () => {
  // Two touching blocks inside the window: no gap between them.
  assert.deepEqual(
    findFreeSlots(
      [
        { start: 100, end: 200 },
        { start: 200, end: 300 },
      ],
      { start: 0, end: 400 },
      10
    ),
    [
      { start: 0, end: 100 },
      { start: 300, end: 400 },
    ]
  );
  // Clipping: a block straddling an edge is trimmed to it.
  assert.deepEqual(
    findFreeSlots([{ start: 50, end: 150 }], { start: 0, end: 100 }, 10),
    [{ start: 0, end: 50 }]
  );
  // A block spanning the whole window, and one exactly filling it: nothing free.
  assert.deepEqual(findFreeSlots([{ start: -50, end: 150 }], { start: 0, end: 100 }, 10), []);
  assert.deepEqual(findFreeSlots([{ start: 50, end: 150 }], { start: 50, end: 150 }, 0), []);
  assert.deepEqual(
    findFreeSlots([{ start: -500, end: 5000, label: 'away' }], { start: 0, end: 100 }, 0),
    []
  );
  assert.deepEqual(findFreeSlots([{ start: -500, end: 5000 }], { start: 0, end: 100 }, 1), []);
});

test('minDurationMs 0 never returns zero-length slots at window edges', () => {
  assert.deepEqual(findFreeSlots([{ start: 0, end: 100 }], { start: 0, end: 100 }, 0), []);
  assert.deepEqual(
    findFreeSlots([{ start: 100, end: 200 }], { start: 100, end: 300 }, 0),
    [{ start: 200, end: 300 }]
  );
});

test('a gap of exactly minDurationMs is included (inclusive boundary)', () => {
  const out = findFreeSlots([{ start: 100, end: 200 }], { start: 0, end: 300 }, 100);
  assert.deepEqual(out, [
    { start: 0, end: 100 },
    { start: 200, end: 300 },
  ]);
  const shorter = findFreeSlots([{ start: 100, end: 200 }], { start: 0, end: 299 }, 100);
  assert.deepEqual(shorter, [{ start: 0, end: 100 }], 'the 99ms tail gap is dropped');
});

test('gaps shorter than minDurationMs are dropped but exact-boundary neighbours kept', () => {
  // Blocks at [0,100] [150,200] [400,500]: gaps of 50ms, 200ms and 100ms.
  const out = findFreeSlots(
    [
      { start: 0, end: 100 },
      { start: 150, end: 200 },
      { start: 400, end: 500 },
    ],
    { start: 0, end: 600 },
    100
  );
  assert.deepEqual(out, [
    { start: 200, end: 400 },
    { start: 500, end: 600 },
  ]);
});

test('offsetMin shifts the window before comparison (both edges, sign included)', () => {
  // Real window [0,100]; shifted by +60min the window is [3600000, 3600100].
  const out = findFreeSlots(
    [{ start: 3600000, end: 3600050 }],
    { start: 0, end: 100 },
    1,
    { offsetMin: 60 }
  );
  assert.deepEqual(out, [{ start: 3600050, end: 3600100 }]);
  // Negative offset: window [0,100] becomes [-3600000, -3599900].
  const out2 = findFreeSlots(
    [{ start: -3600000, end: -3599950 }],
    { start: 0, end: 100 },
    1,
    { offsetMin: -60 }
  );
  assert.deepEqual(out2, [{ start: -3599950, end: -3599900 }]);
});

test('offset arithmetic across zero, offset 0 equivalence, and plain slot objects', () => {
  // Window [0,100] shifted by -1min is [-60000,-59900]; the interval sits there.
  assert.deepEqual(
    findFreeSlots([{ start: -60000, end: -59950 }], { start: 0, end: 100 }, 1, {
      offsetMin: -1,
    }),
    [{ start: -59950, end: -59900 }]
  );
  // A window entirely in the negatives shifted to the positives.
  assert.deepEqual(
    findFreeSlots([], { start: -60000, end: -59900 }, 1, { offsetMin: 1 }),
    [{ start: 0, end: 100 }]
  );
  // offset 0 behaves exactly like an omitted opts.
  const iv = [{ start: 50, end: 60, label: 'busy' }];
  const w = { start: 0, end: 100 };
  const expected = [
    { start: 0, end: 50 },
    { start: 60, end: 100 },
  ];
  assert.deepEqual(findFreeSlots(iv, w, 1, { offsetMin: 0 }), expected);
  assert.deepEqual(findFreeSlots(iv, w, 1), expected);
  // Returned slots are plain {start, end} objects without a label property.
  for (const slot of findFreeSlots(iv, w, 1)) {
    assert.equal('label' in slot, false);
    assert.equal(Object.keys(slot).length, 2);
  }
});
