import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregate } from '../src/aggregate.js';

test('values are parsed with Number after trimming; unparseable rows are excluded from value ops but still counted', () => {
  const csv = [
    'g,v',
    'a, 3',
    'a,4 ',
    'a,abc',
    'a,',
    'a,1e2',
    'a,0x10',
  ].join('\n');
  const out = aggregate(csv, { groupCol: 'g', valueCol: 'v', ops: ['count', 'sum', 'min', 'max', 'mean'] });
  // parseable: 3, 4, 100 (1e2), 16 (0x10) -> sum 123, min 3, max 100, mean 30.75
  assert.deepEqual(out, [
    { group: 'a', count: 6, sum: 123, min: 3, max: 100, mean: 30.75 },
  ]);
});

test('mean is rounded to 3 decimals via Math.round(sum/n*1000)/1000', () => {
  const csv = 'g,v\na,1\na,1\na,1';
  const out = aggregate(csv, { groupCol: 'g', valueCol: 'v', ops: ['mean'] });
  assert.deepEqual(out, [{ group: 'a', mean: 1 }]);
  // 10/3 = 3.3333... -> 3333.33 -> Math.round -> 3333 -> 3.333
  const csv2 = 'g,v\na,10\na,0\na,0';
  const out2 = aggregate(csv2, { groupCol: 'g', valueCol: 'v', ops: ['mean'] });
  assert.deepEqual(out2, [{ group: 'a', mean: 3.333 }]);
});

test('mean rounding is half away from zero for positives and negatives', () => {
  // mean = 1/2000 = 0.0005 -> 0.0005*1000 = 0.5 -> Math.round(0.5) = 1 -> 0.001
  const csvP = 'g,v\na,1\n' + 'a,0\n'.repeat(1999);
  const outP = aggregate(csvP, { groupCol: 'g', valueCol: 'v', ops: ['mean'] });
  assert.deepEqual(outP, [{ group: 'a', mean: 0.001 }]);
  // mean = -2.6785 over 10 rows -> -267.85 -> Math.round(-267.85) = -268 -> -0.268
  const csvN = 'g,v\nb,-2.6785\n' + 'b,0\n'.repeat(9);
  const outN = aggregate(csvN, { groupCol: 'g', valueCol: 'v', ops: ['mean'] });
  assert.deepEqual(outN, [{ group: 'b', mean: -0.268 }]);
});

test('a group with no parseable values: sum 0, min/max/mean null, count still includes the rows', () => {
  const csv = 'g,v\na,x\na,\na,y\nb,5';
  const out = aggregate(csv, { groupCol: 'g', valueCol: 'v', ops: ['count', 'sum', 'min', 'max', 'mean'] });
  assert.deepEqual(out, [
    { group: 'a', count: 3, sum: 0, min: null, max: null, mean: null },
    { group: 'b', count: 1, sum: 5, min: 5, max: 5, mean: 5 },
  ]);
});

test('ops is respected: only requested properties are present, in the given order', () => {
  const csv = 'g,v\na,1\na,2';
  const out = aggregate(csv, { groupCol: 'g', valueCol: 'v', ops: ['max', 'sum'] });
  assert.deepEqual(Object.keys(out[0]), ['group', 'max', 'sum']);
  assert.deepEqual(out, [{ group: 'a', max: 2, sum: 3 }]);

  const out2 = aggregate(csv, { groupCol: 'g', valueCol: 'v', ops: [] });
  assert.deepEqual(out2, [{ group: 'a' }]);
});

test('repeating an op in ops keeps the first position for that key', () => {
  const csv = 'g,v\na,1';
  const out = aggregate(csv, { groupCol: 'g', valueCol: 'v', ops: ['sum', 'min', 'sum'] });
  assert.deepEqual(Object.keys(out[0]), ['group', 'sum', 'min']);
  assert.deepEqual(out, [{ group: 'a', sum: 1, min: 1 }]);
});

test('negative and fractional values aggregate correctly', () => {
  const csv = 'g,v\na,-1.5\na,-2.5\na,0.25';
  const out = aggregate(csv, { groupCol: 'g', valueCol: 'v', ops: ['count', 'sum', 'min', 'max', 'mean'] });
  assert.deepEqual(out, [
    { group: 'a', count: 3, sum: -3.75, min: -2.5, max: 0.25, mean: -1.25 },
  ]);
});

test('independent groups accumulate independently across interleaved rows', () => {
  const csv = 'g,v\nx,1\ny,10\nx,2\ny,20\nx,3\ny,30';
  const out = aggregate(csv, { groupCol: 'g', valueCol: 'v', ops: ['sum', 'min', 'max', 'mean'] });
  assert.deepEqual(out, [
    { group: 'x', sum: 6, min: 1, max: 3, mean: 2 },
    { group: 'y', sum: 60, min: 10, max: 30, mean: 20 },
  ]);
});
