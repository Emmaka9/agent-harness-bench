import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validators, validateCreate } from '../src/validate.js';

test('validators exposes exactly name, qty, tags as functions returning booleans', () => {
  assert.equal(typeof validators, 'object');
  assert.deepEqual(Object.keys(validators).sort(), ['name', 'qty', 'tags']);
  for (const key of ['name', 'qty', 'tags']) {
    assert.equal(typeof validators[key], 'function');
    assert.equal(typeof validators[key]('x'), 'boolean');
  }
});

test('validators.name and validators.qty follow the create rules', () => {
  assert.equal(validators.name('ok'), true);
  assert.equal(validators.name('  spaced  '), true);
  assert.equal(validators.name('   '), false);
  assert.equal(validators.name(''), false);
  assert.equal(validators.name(undefined), false);
  assert.equal(validators.name(5), false);
  assert.equal(validators.name(null), false);

  assert.equal(validators.qty(0), true);
  assert.equal(validators.qty(3), true);
  assert.equal(validators.qty(1.5), false);
  assert.equal(validators.qty(-1), false);
  assert.equal(validators.qty(NaN), false);
  assert.equal(validators.qty(Infinity), false);
  assert.equal(validators.qty('3'), false);
  assert.equal(validators.qty(null), false);
  assert.equal(validators.qty(undefined), false);
});

test('validators.tags accepts only arrays of strings', () => {
  assert.equal(validators.tags([]), true);
  assert.equal(validators.tags(['a', 'b']), true);
  assert.equal(validators.tags(['a', 1]), false);
  assert.equal(validators.tags('a,b'), false);
  assert.equal(validators.tags(['a', undefined]), false);
});

test('validateCreate keeps its original behavior when built on validators', () => {
  assert.deepEqual(validateCreate({ name: 'a', qty: 1 }), { ok: true });
  assert.deepEqual(validateCreate({ name: 'a', qty: 1, tags: [] }), { ok: true });
  assert.deepEqual(validateCreate({ name: 'a', qty: 1, tags: ['t'], other: 'ignored' }), { ok: true });
  assert.deepEqual(validateCreate({ qty: 1 }), { ok: false, errors: { name: 'invalid' } });
  assert.deepEqual(validateCreate({ name: 'a', qty: -2 }), { ok: false, errors: { qty: 'invalid' } });
  assert.deepEqual(validateCreate({ name: 'a', qty: 1, tags: [1] }), { ok: false, errors: { tags: 'invalid' } });
  assert.deepEqual(
    validateCreate({ name: '', qty: 1.5, tags: 'x', extra: 9 }),
    { ok: false, errors: { name: 'invalid', qty: 'invalid', tags: 'invalid' } },
  );
});
