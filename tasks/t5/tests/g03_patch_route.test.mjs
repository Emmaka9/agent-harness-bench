import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../src/router.js';

function seed() {
  return dispatch({ method: 'POST', path: 'items', body: { name: 'widget', qty: 4, tags: ['a'] } }).body.id;
}

test('PATCH updates only the provided fields and returns 200 with the updated doc', () => {
  const id = seed();
  const res = dispatch({ method: 'PATCH', path: `items/${id}`, body: { qty: 9 } });
  assert.deepEqual(res, { status: 200, body: { id, name: 'widget', qty: 9, tags: ['a'] } });
  assert.deepEqual(dispatch({ method: 'GET', path: `items/${id}` }).body, {
    id,
    name: 'widget',
    qty: 9,
    tags: ['a'],
  });
});

test('PATCH can add a field that was absent at create time', () => {
  const id = dispatch({ method: 'POST', path: 'items', body: { name: 'w', qty: 1 } }).body.id;
  const res = dispatch({ method: 'PATCH', path: `items/${id}`, body: { tags: ['new'] } });
  assert.deepEqual(res, { status: 200, body: { id, name: 'w', qty: 1, tags: ['new'] } });
});

test('PATCH with invalid fields returns 400, leaves the doc unchanged, and does not touch other docs', () => {
  const a = seed();
  const b = dispatch({ method: 'POST', path: 'items', body: { name: 'b', qty: 2 } }).body.id;
  const res = dispatch({ method: 'PATCH', path: `items/${a}`, body: { qty: -3, tags: [1] } });
  assert.deepEqual(res, { status: 400, body: { error: 'invalid patch', fields: { qty: true, tags: true } } });
  assert.equal(dispatch({ method: 'GET', path: `items/${a}` }).body.qty, 4);
  assert.equal(dispatch({ method: 'GET', path: `items/${b}` }).body.qty, 2);
});

test('PATCH on unknown id: invalid patch is 400, valid patch is 404, dispatch never throws', () => {
  assert.deepEqual(dispatch({ method: 'PATCH', path: 'items/nope', body: { qty: -1 } }), {
    status: 400,
    body: { error: 'invalid patch', fields: { qty: true } },
  });
  assert.deepEqual(dispatch({ method: 'PATCH', path: 'items/nope', body: { qty: 2 } }), {
    status: 404,
    body: { error: 'not found' },
  });
});

test('PATCH with a non-object body is 400 with error invalid patch and empty fields', () => {
  const id = seed();
  assert.deepEqual(dispatch({ method: 'PATCH', path: `items/${id}`, body: null }), {
    status: 400,
    body: { error: 'invalid patch', fields: {} },
  });
  assert.deepEqual(dispatch({ method: 'PATCH', path: `items/${id}`, body: [1] }), {
    status: 400,
    body: { error: 'invalid patch', fields: {} },
  });
  assert.deepEqual(dispatch({ method: 'PATCH', path: `items/${id}`, body: 'qty' }), {
    status: 400,
    body: { error: 'invalid patch', fields: {} },
  });
});

test('PATCH with an empty object body is valid and returns the unchanged doc', () => {
  const id = seed();
  const res = dispatch({ method: 'PATCH', path: `items/${id}`, body: {} });
  assert.deepEqual(res, { status: 200, body: { id, name: 'widget', qty: 4, tags: ['a'] } });
});

test('PATCH fields outside the schema pass validation and are merged', () => {
  const id = seed();
  const res = dispatch({ method: 'PATCH', path: `items/${id}`, body: { whatever: 'x', qty: 2 } });
  assert.equal(res.status, 200);
  assert.equal(res.body.whatever, 'x');
  assert.equal(res.body.qty, 2);
});

test('PATCH ignores undefined-valued keys and a patch cannot change the id', () => {
  const id = seed();
  const res = dispatch({ method: 'PATCH', path: `items/${id}`, body: { name: undefined, qty: 6, id: 'zzz' } });
  assert.deepEqual(res, { status: 200, body: { id, name: 'widget', qty: 6, tags: ['a'] } });
  assert.equal(dispatch({ method: 'GET', path: 'items/zzz' }).status, 404);
});
