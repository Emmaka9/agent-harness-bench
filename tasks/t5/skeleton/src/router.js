// Request dispatch table: {method, path, body} -> {status, body}.
// Supported paths are exactly `items` (collection) and `items/<id>` (item).

import { Store, NotFoundError } from './store.js';
import { validateCreate } from './validate.js';

const store = new Store();

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Returns ['items'], ['items', id], or null when the path matches nothing.
function splitPath(path) {
  if (typeof path !== 'string') return null;
  if (path === 'items') return ['items'];
  const m = /^items\/([^/]+)$/.exec(path);
  if (m !== null) return ['items', m[1]];
  return null;
}

function createItem(body) {
  if (!isPlainObject(body)) {
    return { status: 400, body: { error: 'invalid body', fields: {} } };
  }
  const result = validateCreate(body);
  if (!result.ok) {
    return { status: 400, body: { error: 'invalid body', fields: result.errors } };
  }
  return { status: 201, body: store.create(body) };
}

function getItem(id) {
  const doc = store.get(id);
  if (doc === null) return { status: 404, body: { error: 'not found' } };
  return { status: 200, body: doc };
}

function deleteItem(id) {
  store.delete(id);
  return { status: 200, body: { deleted: true } };
}

export function dispatch(req) {
  const method = typeof req?.method === 'string' ? req.method : '';
  const parts = splitPath(req?.path);
  if (parts === null) {
    return { status: 404, body: { error: 'not found' } };
  }

  try {
    if (parts.length === 1) {
      if (method === 'GET') return { status: 200, body: store.list() };
      if (method === 'POST') return createItem(req.body);
      return { status: 405, body: { error: 'method not allowed' } };
    }
    const id = parts[1];
    if (method === 'GET') return getItem(id);
    if (method === 'DELETE') return deleteItem(id);
    return { status: 405, body: { error: 'method not allowed' } };
  } catch (err) {
    if (err instanceof NotFoundError) {
      return { status: 404, body: { error: 'not found' } };
    }
    throw err;
  }
}
