import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateSchema } from '../src/validate.js';

test('happy path nested object passes with empty errors', () => {
  const schema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' } },
      meta: {
        type: 'object',
        properties: { depth: { type: 'number' } },
        required: ['depth'],
      },
    },
    required: ['name'],
  };
  const value = {
    name: 'root',
    tags: ['a', 'b'],
    meta: { depth: 2 },
  };
  assert.deepEqual(validateSchema(schema, value), { ok: true, errors: [] });
});

test('type match rules for object array number string boolean null', () => {
  const cases = [
    ['object', {}, true],
    ['object', [], false],
    ['object', null, false],
    ['object', 'x', false],
    ['array', [], true],
    ['array', {}, false],
    ['string', 'x', true],
    ['string', 5, false],
    ['boolean', true, true],
    ['boolean', 1, false],
    ['number', 5, true],
    ['number', Infinity, true],
    ['number', NaN, false],
    ['number', '5', false],
    ['null', null, true],
    ['null', 0, false],
    ['null', undefined, false],
  ];
  for (const [type, value, matches] of cases) {
    const r = validateSchema({ type }, value);
    assert.equal(r.ok, matches, `type=${type} value=${String(value)}`);
    if (!matches) {
      assert.deepEqual(r.errors, [`: expected ${type}`]);
    } else {
      assert.deepEqual(r.errors, []);
    }
  }
});

test('root type failure uses the empty path prefix', () => {
  assert.deepEqual(validateSchema({ type: 'string' }, 5), {
    ok: false,
    errors: [': expected string'],
  });
});

test('every present keyword is checked and order is type required properties items enum', () => {
  // Schema keys deliberately written in reverse order; error order must not follow them.
  const schema = { enum: ['s'], type: 'string', required: ['a'] };
  const r = validateSchema(schema, 5);
  assert.deepEqual(r.errors, [': expected string', ': value not in enum']);
  assert.equal(r.ok, false);
});
