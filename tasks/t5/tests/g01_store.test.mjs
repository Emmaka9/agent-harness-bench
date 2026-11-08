import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store, NotFoundError } from '../src/store.js';

test('create assigns sequential string ids; get, list, delete work; delete unknown id throws', () => {
  const s = new Store();
  const a = s.create({ name: 'a', qty: 1 });
  const b = s.create({ name: 'b', qty: 2 });
  assert.equal(a.id, '1');
  assert.equal(b.id, '2');
  assert.deepEqual(s.get('1'), { id: '1', name: 'a', qty: 1 });
  assert.equal(s.get('999'), null);
  assert.equal(s.list().length, 2);
  s.delete('1');
  assert.equal(s.list().length, 1);
  assert.deepEqual(s.list()[0], { id: '2', name: 'b', qty: 2 });
  assert.throws(() => s.delete('1'), NotFoundError);
});

test('update shallow-merges provided fields, preserves id, and adds new keys', () => {
  const s = new Store();
  s.create({ name: 'a', qty: 1 });
  const out = s.update('1', { id: 'zzz', qty: 10, tags: ['x'], extra: 'kept' });
  assert.deepEqual(out, { id: '1', name: 'a', qty: 10, tags: ['x'], extra: 'kept' });
  assert.deepEqual(s.get('1'), { id: '1', name: 'a', qty: 10, tags: ['x'], extra: 'kept' });
  assert.equal(s.get('zzz'), null);
});

test('update skips undefined values instead of overwriting or adding', () => {
  const s = new Store();
  s.create({ name: 'a', qty: 5 });
  const out = s.update('1', { qty: undefined, name: 'b', tags: undefined });
  assert.deepEqual(out, { id: '1', name: 'b', qty: 5 });
  assert.equal('tags' in out, false);
});

test('update returns a new object and never mutates earlier snapshots', () => {
  const s = new Store();
  const before = s.create({ name: 'a', qty: 1 });
  const snapshot = { ...before };
  const after = s.update('1', { qty: 2 });
  assert.notEqual(before, after);
  assert.deepEqual(before, snapshot);
  assert.deepEqual(s.get('1'), { id: '1', name: 'a', qty: 2 });
  const second = s.update('1', { qty: 3 });
  assert.equal(second.qty, 3);
  assert.equal(after.qty, 2);
  assert.equal(before.qty, 1);
});

test('update on an unknown id throws NotFoundError named NotFoundError', () => {
  const s = new Store();
  try {
    s.update('404', { qty: 1 });
    assert.fail('expected NotFoundError');
  } catch (err) {
    assert.ok(err instanceof NotFoundError);
    assert.equal(err.name, 'NotFoundError');
  }
});
