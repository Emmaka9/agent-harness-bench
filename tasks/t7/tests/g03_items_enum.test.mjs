import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateSchema } from '../src/validate.js';

test('items validates every element in ascending index order with path[i]', () => {
  const schema = { items: { type: 'number' } };
  const r = validateSchema(schema, [1, 'x', 3, true]);
  assert.deepEqual(r.errors, ['[1]: expected number', '[3]: expected number']);
  const ok = validateSchema(schema, [1, 2, 3]);
  assert.deepEqual(ok, { ok: true, errors: [] });
});

test('example from the spec: items[2].name expected string', () => {
  const schema = {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: { name: { type: 'string' } },
          required: ['name'],
        },
      },
    },
  };
  const value = { items: [{ name: 'a' }, 42, { name: 3 }] };
  assert.deepEqual(validateSchema(schema, value), {
    ok: false,
    errors: [
      'items[1]: expected object',
      'items[2].name: expected string',
    ],
  });
});

test('items applies only when the value is an array and empty arrays pass', () => {
  assert.deepEqual(validateSchema({ items: { type: 'string' } }, []), {
    ok: true,
    errors: [],
  });
  assert.deepEqual(validateSchema({ items: { type: 'string' } }, { 0: 'x' }), {
    ok: true,
    errors: [],
  });
  assert.deepEqual(validateSchema({ items: { type: 'string' } }, 'abc'), {
    ok: true,
    errors: [],
  });
});

test('enum membership uses Object.is for primitives including null and NaN', () => {
  const schema = { enum: [1, 'one', null, NaN, true] };
  assert.deepEqual(validateSchema(schema, NaN), { ok: true, errors: [] });
  assert.deepEqual(validateSchema(schema, null), { ok: true, errors: [] });
  assert.deepEqual(validateSchema(schema, 1), { ok: true, errors: [] });
  const r = validateSchema(schema, 2);
  assert.deepEqual(r.errors, [': value not in enum']);
  const zero = validateSchema({ enum: [0] }, -0);
  assert.deepEqual(zero.errors, [': value not in enum']);
});

test('enum compares arrays and objects structurally and applies at every path', () => {
  const schema = { properties: { p: { enum: [[1, 2], { a: 1 }] } } };
  assert.deepEqual(validateSchema(schema, { p: [1, 2] }), {
    ok: true,
    errors: [],
  });
  assert.deepEqual(validateSchema(schema, { p: { a: 1 } }), {
    ok: true,
    errors: [],
  });
  assert.deepEqual(validateSchema(schema, { p: { a: 1, b: 2 } }), {
    ok: false,
    errors: ['p: value not in enum'],
  });
  assert.deepEqual(validateSchema(schema, { p: [1, 2, 3] }), {
    ok: false,
    errors: ['p: value not in enum'],
  });
  const nested = validateSchema(
    { items: { enum: ['a'] } },
    ['a', 'b']
  );
  assert.deepEqual(nested.errors, ['[1]: value not in enum']);
});
