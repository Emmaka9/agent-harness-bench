import { test } from 'node:test';
import assert from 'node:assert/strict';
import { order } from '../src/topo.js';

test('every edge constraint satisfied on a longer chain', () => {
  const nodes = ['n1', 'n2', 'n3', 'n4', 'n5'];
  const edges = [
    ['n5', 'n4'],
    ['n4', 'n3'],
    ['n3', 'n2'],
    ['n2', 'n1'],
  ];
  const result = order(nodes, edges);
  assert.deepEqual(result, ['n5', 'n4', 'n3', 'n2', 'n1']);
});

test('arguments are not mutated', () => {
  const nodes = ['b', 'a', 'c'];
  const edges = [['a', 'b']];
  const nodesCopy = [...nodes];
  const edgesCopy = edges.map((e) => [...e]);
  order(nodes, edges);
  assert.deepEqual(nodes, nodesCopy);
  assert.deepEqual(edges, edgesCopy);
});

test('alphabetical comparison is plain code-unit order on ids', () => {
  const nodes = ['b10', 'b2', 'a'];
  const result = order(nodes, [['a', 'b10']]);
  // free initially: a and b2 -> a; then b10 and b2 -> "b10" < "b2" by code units.
  assert.deepEqual(result, ['a', 'b10', 'b2']);
});

test('longer cycle detected across disjoint components', () => {
  const nodes = ['iso', 'p', 'q', 'r'];
  const edges = [
    ['p', 'q'],
    ['q', 'r'],
    ['r', 'p'],
  ];
  assert.throws(() => order(nodes, edges), (err) => {
    assert.equal(err.name, 'Error');
    assert.match(err.message, /^cycle detected: /);
    const path = err.message.slice('cycle detected: '.length).split(' -> ');
    assert.equal(path[0], path[path.length - 1]);
    const core = path.slice(0, -1);
    for (const id of core) {
      assert.ok(['p', 'q', 'r'].includes(id), `${id} belongs to the cycle`);
    }
    return true;
  });
});

