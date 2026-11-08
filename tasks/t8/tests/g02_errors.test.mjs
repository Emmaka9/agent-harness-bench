import { test } from 'node:test';
import assert from 'node:assert/strict';
import { order } from '../src/topo.js';

test('unknown before endpoint throws with exact message', () => {
  assert.throws(() => order(['a'], [['z', 'a']]), {
    name: 'Error',
    message: 'unknown node: z',
  });
});

test('unknown after endpoint throws with exact message', () => {
  assert.throws(() => order(['a'], [['a', 'q']]), {
    name: 'Error',
    message: 'unknown node: q',
  });
});

test('first offending edge endpoint wins', () => {
  assert.throws(
    () =>
      order(['a', 'b'], [
        ['a', 'zz'],
        ['yy', 'b'],
      ]),
    { message: 'unknown node: zz' }
  );
  assert.throws(
    () =>
      order(['a', 'b'], [
        ['xx', 'b'],
        ['a', 'zz'],
      ]),
    { message: 'unknown node: xx' }
  );
});

test('unknown check runs before cycle detection', () => {
  assert.throws(() => order(['a', 'b'], [['a', 'b'], ['b', 'a'], ['a', 'ghost']]), {
    message: 'unknown node: ghost',
  });
});

test('self edge is a cycle with exact message', () => {
  assert.throws(() => order(['a'], [['a', 'a']]), {
    name: 'Error',
    message: 'cycle detected: a -> a',
  });
});

test('two node cycle names real ids and closes the loop', () => {
  const edges = [
    ['a', 'b'],
    ['b', 'a'],
  ];
  assert.throws(() => order(['a', 'b'], edges), (err) => {
    assert.equal(err.name, 'Error');
    assert.match(err.message, /^cycle detected: /);
    const path = err.message.slice('cycle detected: '.length).split(' -> ');
    const first = path[0];
    assert.equal(path[path.length - 1], first);
    assert.ok(path.length >= 3, 'closed path has at least a -> b -> a shape');
    for (const id of path) {
      assert.ok(['a', 'b'].includes(id), `${id} is a real node id`);
    }
    for (let i = 0; i < path.length - 1; i++) {
      const u = path[i];
      const v = path[i + 1];
      const hasEdge = edges.some(([b, a]) => b === u && a === v);
      assert.ok(hasEdge, `step ${u} -> ${v} follows a real edge`);
    }
    return true;
  });
});

test('three node cycle message is a valid closed path', () => {
  assert.throws(
    () =>
      order(['m', 'n', 'p', 'free'], [
        ['m', 'n'],
        ['n', 'p'],
        ['p', 'm'],
      ]),
    (err) => {
      assert.equal(err.name, 'Error');
      assert.match(err.message, /^cycle detected: /);
      const path = err.message.slice('cycle detected: '.length).split(' -> ');
      assert.equal(path[0], path[path.length - 1]);
      const core = path.slice(0, -1);
      assert.equal(new Set(core).size, core.length, 'cycle nodes are distinct');
      const allEdges = [
        ['m', 'n'],
        ['n', 'p'],
        ['p', 'm'],
      ];
      for (let i = 0; i < path.length - 1; i++) {
        const u = path[i];
        const v = path[i + 1];
        assert.ok(
          allEdges.some(([b, a]) => b === u && a === v),
          `step ${u} -> ${v} follows a real edge`
        );
      }
      for (const id of core) {
        assert.ok(['m', 'n', 'p'].includes(id), 'cycle stays inside the loop');
      }
      return true;
    }
  );
});

test('acyclic graph with shared dependency does not throw', () => {
  assert.deepEqual(
    order(['util', 'app', 'lib'], [
      ['lib', 'app'],
      ['util', 'app'],
    ]),
    ['lib', 'util', 'app']
  );
});
