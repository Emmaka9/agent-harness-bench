import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateSchema } from '../src/validate.js';

test('required checks own-property presence so undefined values count as present', () => {
  const schema = { required: ['x'] };
  assert.deepEqual(validateSchema(schema, { x: undefined }), {
    ok: true,
    errors: [],
  });
  const r = validateSchema(schema, {});
  assert.deepEqual(r.errors, [': missing required property "x"']);
});

test('required errors use the required array order and quoted names', () => {
  const r = validateSchema(
    { required: ['b', 'a'], type: 'object' },
    { a: 1 }
  );
  assert.deepEqual(r.errors, [
    ': missing required property "b"',
  ]);
  const r2 = validateSchema({ required: ['b', 'a'] }, {});
  assert.deepEqual(r2.errors, [
    ': missing required property "b"',
    ': missing required property "a"',
  ]);
  const r3 = validateSchema({ required: ['a'] }, { a: null });
  assert.deepEqual(r3.errors, []);
});

test('properties validates only own present keys recursively and skips absent keys', () => {
  const schema = {
    properties: {
      a: { type: 'number' },
      b: { type: 'string' },
      nested: { properties: { deep: { type: 'boolean' } } },
    },
  };
  const r = validateSchema(schema, { a: 1, nested: { deep: 'no' } });
  assert.deepEqual(r.errors, ['nested.deep: expected boolean']);
  const r2 = validateSchema(schema, { a: 'bad' });
  assert.deepEqual(r2.errors, ['a: expected number']);
  const r3 = validateSchema(schema, { b: 'ok' });
  assert.deepEqual(r3, { ok: true, errors: [] });
});

test('required and properties impose no constraint on non-object values', () => {
  const schema = {
    type: 'object',
    required: ['a'],
    properties: { a: { type: 'string' } },
  };
  assert.deepEqual(validateSchema(schema, null), {
    ok: false,
    errors: [': expected object'],
  });
  assert.deepEqual(validateSchema(schema, [1, 2]), {
    ok: false,
    errors: [': expected object'],
  });
  const noType = { required: ['a'], properties: { a: { type: 'string' } } };
  assert.deepEqual(validateSchema(noType, 'anything'), {
    ok: true,
    errors: [],
  });
});

test('within properties errors follow the properties key order', () => {
  const r = validateSchema(
    { properties: { b: { type: 'string' }, a: { type: 'string' } } },
    { b: 1, a: 2 }
  );
  assert.deepEqual(r.errors, ['b: expected string', 'a: expected string']);
});
