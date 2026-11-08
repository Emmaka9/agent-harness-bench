import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateSchema } from '../src/validate.js';

test('unknown keywords are ignored and absent keywords impose no constraint', () => {
  const schema = {
    title: 'thing',
    minItems: 2,
    properties: { a: { type: 'string', maxLength: 2 } },
  };
  assert.deepEqual(validateSchema(schema, { a: 'way too long' }), {
    ok: true,
    errors: [],
  });
  assert.deepEqual(validateSchema({}, 'any value at all'), {
    ok: true,
    errors: [],
  });
});

test('result contains a fresh errors array and inputs are not mutated', () => {
  const schema = { type: 'object', required: ['a'] };
  const value = { b: 1 };
  const schemaSnapshot = JSON.stringify(schema);
  const valueSnapshot = JSON.stringify(value);
  const r1 = validateSchema(schema, value);
  const r2 = validateSchema(schema, value);
  r1.errors.push('polluted');
  assert.deepEqual(r2.errors, [': missing required property "a"']);
  assert.equal(JSON.stringify(schema), schemaSnapshot);
  assert.equal(JSON.stringify(value), valueSnapshot);
  assert.deepEqual(validateSchema({ type: 'string' }, 'x'), {
    ok: true,
    errors: [],
  });
});

test('deeply nested paths join with dots and brackets', () => {
  const schema = {
    properties: {
      rows: {
        items: {
          properties: {
            cells: { items: { type: 'number' } },
          },
        },
      },
    },
  };
  const r = validateSchema(schema, {
    rows: [{ cells: [1, 'x'] }, { cells: ['y'] }],
  });
  assert.deepEqual(r.errors, [
    'rows[0].cells[1]: expected number',
    'rows[1].cells[0]: expected number',
  ]);
});

test('properties subschema with items and required together reports all failures', () => {
  const schema = {
    properties: {
      list: {
        type: 'array',
        items: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'number' } },
        },
      },
    },
  };
  const r = validateSchema(schema, { list: [{ id: 1 }, { id: 'x' }, {}] });
  assert.deepEqual(r.errors, [
    'list[1].id: expected number',
    'list[2]: missing required property "id"',
  ]);
});
