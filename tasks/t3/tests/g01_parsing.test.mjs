import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregate } from '../src/aggregate.js';

test('basic unquoted CSV aggregates by group with all ops', () => {
  const csv = [
    'region,sales',
    'east,10',
    'west,20',
    'east,30',
    'west,40',
  ].join('\n');
  const out = aggregate(csv, { groupCol: 'region', valueCol: 'sales', ops: ['count', 'sum', 'min', 'max', 'mean'] });
  assert.deepEqual(out, [
    { group: 'east', count: 2, sum: 40, min: 10, max: 30, mean: 20 },
    { group: 'west', count: 2, sum: 60, min: 20, max: 40, mean: 30 },
  ]);
});

test('result objects are ordered by first appearance of the group', () => {
  const csv = 'g,v\nb,1\na,2\nb,3\nc,4\na,5';
  const out = aggregate(csv, { groupCol: 'g', valueCol: 'v', ops: ['count'] });
  assert.deepEqual(out.map((r) => r.group), ['b', 'a', 'c']);
  assert.deepEqual(out.map((r) => r.count), [2, 2, 1]);
});

test('quoted fields with embedded commas, doubled quotes, and newlines', () => {
  const csv = [
    'name,note',
    '"Doe, Jane","said ""hi"" loudly"',
    'Bob,"line1\nline2"',
  ].join('\n');
  const out = aggregate(csv, { groupCol: 'name', valueCol: 'note', ops: ['count'] });
  assert.deepEqual(out, [
    { group: 'Doe, Jane', count: 1 },
    { group: 'Bob', count: 1 },
  ]);
});

test('a quoted field may span multiple physical lines and CRLF row separators', () => {
  const csv = 'k,v\r\n"x\r\ny",5\r\n"x\r\ny",7\r\n';
  const out = aggregate(csv, { groupCol: 'k', valueCol: 'v', ops: ['count', 'sum'] });
  assert.deepEqual(out, [{ group: 'x\r\ny', count: 2, sum: 12 }]);
});

test('empty lines anywhere are skipped and a trailing line break is optional', () => {
  const csvA = 'g,v\n\na,1\n\na,3\n';
  const outA = aggregate(csvA, { groupCol: 'g', valueCol: 'v', ops: ['count', 'sum'] });
  assert.deepEqual(outA, [{ group: 'a', count: 2, sum: 4 }]);

  const csvB = 'g,v\r\n\r\na,1\r\n\r\n\r\na,2';
  const outB = aggregate(csvB, { groupCol: 'g', valueCol: 'v', ops: ['count', 'sum'] });
  assert.deepEqual(outB, [{ group: 'a', count: 2, sum: 3 }]);
});

test('rows with the wrong field count are silently skipped', () => {
  const csv = [
    'g,v',
    'a,1',
    'a',        // too few
    'b,2,extra', // too many
    'b,4',
    ',5',        // valid: group is ""
  ].join('\n');
  const out = aggregate(csv, { groupCol: 'g', valueCol: 'v', ops: ['count'] });
  assert.deepEqual(out, [
    { group: 'a', count: 1 },
    { group: 'b', count: 1 },
    { group: '', count: 1 },
  ]);
});

test('unquoted fields keep surrounding whitespace; quoted fields preserve it too', () => {
  const csv = 'g,v\n a , 7 \n a ,8';
  const out = aggregate(csv, { groupCol: 'g', valueCol: 'v', ops: ['count', 'sum'] });
  // " 7 " parses via Number("7".trim()) -> 7; groups are keyed by " a " (both rows share it)
  assert.deepEqual(out, [{ group: ' a ', count: 2, sum: 15 }]);
});

test('an empty quoted group is a normal group keyed by ""', () => {
  const csv = 'g,v\n"",1\nx,2\n"",3';
  const out = aggregate(csv, { groupCol: 'g', valueCol: 'v', ops: ['count'] });
  assert.deepEqual(out, [
    { group: '', count: 2 },
    { group: 'x', count: 1 },
  ]);
});

test('the first occurrence of a duplicated header name wins', () => {
  const csv = 'g,v,g\na,1,zz\nb,2,yy';
  const out = aggregate(csv, { groupCol: 'g', valueCol: 'v', ops: ['count', 'sum'] });
  assert.deepEqual(out, [
    { group: 'a', count: 1, sum: 1 },
    { group: 'b', count: 1, sum: 2 },
  ]);
  // With groupCol pointing at the LAST "g" it would group by 'zz'/'yy' and
  // produce different groups; the first column named "g" is used instead.
  const out2 = aggregate('g,v,g\na,1,zz\nb,2,yy', { groupCol: 'g', valueCol: 'v', ops: ['count'] });
  assert.deepEqual(out2.map((r) => r.group), ['a', 'b']);
});
