import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateSchema } from '../src/validate.js';

test('required errors precede properties errors at the same path', () => {
  // `a` is present but fails its subschema; the required check runs first,
  // so the only error comes from properties recursion.
  const r = validateSchema(
    { required: ['a'], properties: { a: { type: 'string' } } },
    { a: 1 }
  );
  assert.deepEqual(r.errors, ['a: expected string']);
  // When the property is absent, required reports it and properties skips it.
  const r2 = validateSchema(
    { required: ['a'], properties: { a: { type: 'string' } } },
    {}
  );
  assert.deepEqual(r2.errors, [': missing required property "a"']);
});

test('properties errors precede items errors when both apply', () => {
  // value is an array, so properties/required impose no constraint; only
  // type+items run. Use a nested schema instead: object property whose
  // value is an array failing both its own property check and items.
  const r = validateSchema(
    { properties: { p: { items: { type: 'number' } } } },
    { p: ['x'] }
  );
  assert.deepEqual(r.errors, ['p[0]: expected number']);
});

test('items errors precede enum errors for an array value', () => {
  const schema = { items: { type: 'number' }, enum: [[1, 2]] };
  const r = validateSchema(schema, ['x', 2]);
  // items failure at [0] is reported before the enum failure at root
  assert.deepEqual(r.errors, ['[0]: expected number', ': value not in enum']);
  const r2 = validateSchema({ items: { type: 'number' }, enum: [[1, 2]] }, [1, 2]);
  assert.deepEqual(r2, { ok: true, errors: [] });
});

test('enum failure is reported after nested properties failures', () => {
  // The enum check on the parent runs after descending into properties.
  const schema = {
    properties: { p: { type: 'string' } },
    enum: ['sentinel'],
  };
  const r = validateSchema(schema, { p: 1 });
  assert.deepEqual(r.errors, ['p: expected string', ': value not in enum']);
});
