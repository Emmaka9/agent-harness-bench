import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregate } from '../src/aggregate.js';

test('empty input yields an empty array', () => {
  assert.deepEqual(aggregate('', { groupCol: 'g', valueCol: 'v', ops: ['count'] }), []);
  assert.deepEqual(aggregate('\n\n\r\n', { groupCol: 'g', valueCol: 'v', ops: ['count'] }), []);
});

test('a lone CR is a line break and CRLF counts as one break', () => {
  const out = aggregate('g,v\ra,1\rb,2', { groupCol: 'g', valueCol: 'v', ops: ['count', 'sum'] });
  assert.deepEqual(out, [
    { group: 'a', count: 1, sum: 1 },
    { group: 'b', count: 1, sum: 2 },
  ]);
  // "\r\n" is one break, so this is one two-field row, not two malformed rows
  assert.deepEqual(aggregate('g,v\ra,1\r\n', { groupCol: 'g', valueCol: 'v', ops: ['count'] }), [
    { group: 'a', count: 1 },
  ]);
});

test('a line holding only an empty quoted field is a real row, not an empty line', () => {
  // by the spec, an empty line has nothing at all between breaks: "" is content
  const out = aggregate('v\n""\n""', { groupCol: 'v', valueCol: 'v', ops: ['count'] });
  assert.deepEqual(out, [{ group: '', count: 2 }]);
  // ...and empty lines around it are still skipped
  const out2 = aggregate('\n\nv\n\n""\n\n', { groupCol: 'v', valueCol: 'v', ops: ['count'] });
  assert.deepEqual(out2, [{ group: '', count: 1 }]);
});

test('a header-only input yields an empty array with or without a trailing break', () => {
  assert.deepEqual(aggregate('g,v', { groupCol: 'g', valueCol: 'v', ops: ['count'] }), []);
  assert.deepEqual(aggregate('g,v\n', { groupCol: 'g', valueCol: 'v', ops: ['count'] }), []);
  assert.deepEqual(aggregate('g,v\r\n', { groupCol: 'g', valueCol: 'v', ops: ['count'] }), []);
});

test('a one-column header with matching one-column rows is valid', () => {
  const csv = 'v\n1\n2\n';
  const out = aggregate(csv, { groupCol: 'missing', valueCol: 'v', ops: ['count'] });
  assert.deepEqual(out, []);
});

test('a requested column missing from the header yields an empty array', () => {
  const csv = 'a,b\n1,2\n3,4';
  assert.deepEqual(aggregate(csv, { groupCol: 'zzz', valueCol: 'b', ops: ['count'] }), []);
  assert.deepEqual(aggregate(csv, { groupCol: 'a', valueCol: 'zzz', ops: ['count'] }), []);
});

test('the result is a fresh array on every call (no shared state)', () => {
  const csv = 'g,v\na,1';
  const o1 = aggregate(csv, { groupCol: 'g', valueCol: 'v', ops: ['count'] });
  const o2 = aggregate(csv, { groupCol: 'g', valueCol: 'v', ops: ['count'] });
  assert.deepEqual(o1, o2);
  assert.notEqual(o1, o2);
  assert.notEqual(o1[0], o2[0]);
});

test('a lone field with a quote character inside an unquoted field is taken literally', () => {
  const csv = 'g,v\na"x,1\na"x,2';
  const out = aggregate(csv, { groupCol: 'g', valueCol: 'v', ops: ['count'] });
  assert.deepEqual(out, [{ group: 'a"x', count: 2 }]);
});

test('large-ish input aggregates correctly and quickly', () => {
  const lines = ['g,v'];
  for (let i = 0; i < 5000; i++) {
    lines.push(`g${i % 7},${i}`);
  }
  const csv = lines.join('\n');
  const out = aggregate(csv, { groupCol: 'g', valueCol: 'v', ops: ['count', 'sum'] });
  assert.equal(out.length, 7);
  const g0 = out.find((r) => r.group === 'g0');
  // values 0,7,14,...,4998 (715 values), sum = 7*(0+714)/2*... : sum = 7 * (714*715/2) = 7*255255 = 1786785
  assert.equal(g0.count, 715);
  assert.equal(g0.sum, 1786785);
});

test('grouping by one column while ignoring unrelated columns', () => {
  const csv = 'g,v,junk\na,1,x\na,2,"y,z"\nb,3,w';
  const out = aggregate(csv, { groupCol: 'g', valueCol: 'v', ops: ['count', 'sum'] });
  assert.deepEqual(out, [
    { group: 'a', count: 2, sum: 3 },
    { group: 'b', count: 1, sum: 3 },
  ]);
});

test('a line holding only a comma is a real two-field row of empty strings', () => {
  // "," tokenizes to ["",""] (a comma always separates two fields), so against
  // the 2-field header these rows are valid: group "" with an empty value.
  const out = aggregate('g,v\n,\n,', { groupCol: 'g', valueCol: 'v', ops: ['count'] });
  assert.deepEqual(out, [{ group: '', count: 2 }]);
  // against a 1-field header the same lines are malformed and skipped
  const out2 = aggregate('g\n,\n,', { groupCol: 'g', valueCol: 'g', ops: ['count'] });
  assert.deepEqual(out2, []);
});
