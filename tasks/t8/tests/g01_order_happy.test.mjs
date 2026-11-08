import { test } from 'node:test';
import assert from 'node:assert/strict';
import { order } from '../src/topo.js';

test('empty nodes returns empty array', () => {
  assert.deepEqual(order([], []), []);
});

test('no edges sorts alphabetically regardless of input order', () => {
  assert.deepEqual(order(['c', 'b', 'a'], []), ['a', 'b', 'c']);
  assert.deepEqual(order(['a'], []), ['a']);
});

test('single edge forces before before after', () => {
  assert.deepEqual(order(['b', 'a', 'c'], [['a', 'b']]), ['a', 'b', 'c']);
});

test('example chain produces the pinned deterministic order', () => {
  assert.deepEqual(order(['a', 'b', 'c', 'd'], [['d', 'b'], ['c', 'd']]), [
    'a',
    'c',
    'd',
    'b',
  ]);
});

test('indegree zero tie broken by alphabetical smallest at each step', () => {
  // d and a free initially -> a; then b, d, e free -> b; then d, e -> d; then e -> e; c last after e.
  assert.deepEqual(
    order(['d', 'e', 'c', 'b', 'a'], [
      ['e', 'c'],
      ['b', 'e'],
    ]),
    ['a', 'b', 'd', 'e', 'c']
  );
});

test('diamond dependency respects all constraints', () => {
  const nodes = ['root', 'left', 'right', 'leaf'];
  const edges = [
    ['root', 'left'],
    ['root', 'right'],
    ['left', 'leaf'],
    ['right', 'leaf'],
  ];
  const result = order(nodes, edges);
  assert.deepEqual(result, ['root', 'left', 'right', 'leaf']);
});

test('duplicate node entries treated as a set', () => {
  const result = order(['b', 'a', 'b', 'a'], []);
  assert.deepEqual(result.sort(), ['a', 'b']);
  assert.equal(new Set(result).size, result.length);
});

test('repeated edge between same pair does not double-count indegree', () => {
  assert.deepEqual(
    order(['x', 'y'], [
      ['x', 'y'],
      ['x', 'y'],
    ]),
    ['x', 'y']
  );
});
