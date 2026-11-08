import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../src/router.js';

test('existing routes are unchanged: POST, GET collection, GET item, DELETE', () => {
  const created = dispatch({ method: 'POST', path: 'items', body: { name: 'n', qty: 1 } });
  assert.equal(created.status, 201);
  const id = created.body.id;
  assert.equal(dispatch({ method: 'GET', path: 'items' }).status, 200);
  assert.equal(dispatch({ method: 'GET', path: `items/${id}` }).status, 200);
  assert.equal(dispatch({ method: 'DELETE', path: `items/${id}` }).status, 200);
  assert.equal(dispatch({ method: 'GET', path: `items/${id}` }).status, 404);
});

test('existing POST validation errors are unchanged', () => {
  const res = dispatch({ method: 'POST', path: 'items', body: { qty: 1 } });
  assert.deepEqual(res, { status: 400, body: { error: 'invalid body', fields: { name: 'invalid' } } });
});

test('routing table unchanged: unmatched paths 404, unknown methods 405, case-sensitivity', () => {
  assert.deepEqual(dispatch({ method: 'GET', path: 'widgets' }), { status: 404, body: { error: 'not found' } });
  assert.deepEqual(dispatch({ method: 'GET', path: 'items/a/b' }), { status: 404, body: { error: 'not found' } });
  assert.deepEqual(dispatch({ method: 'PATCH', path: 'items' }), {
    status: 405,
    body: { error: 'method not allowed' },
  });
  assert.deepEqual(dispatch({ method: 'POST', path: 'items/x' }), {
    status: 405,
    body: { error: 'method not allowed' },
  });
  assert.deepEqual(dispatch({ method: 'PUT', path: 'items/x' }), {
    status: 405,
    body: { error: 'method not allowed' },
  });
  assert.equal(dispatch({ method: 'patch', path: 'items/x' }).status, 405);
  assert.equal(dispatch({ method: 'PATCH', path: 'Items/x' }).status, 404);
});
