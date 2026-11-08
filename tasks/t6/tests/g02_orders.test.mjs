import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOrder, getOrder, orderCount } from '../src/orders.js';

test('createOrder builds the same record shape as before', () => {
  const o = createOrder('alice', 'alice@example.com', 3);
  assert.deepEqual(o, { id: 1, user: 'alice', email: 'alice@example.com', qty: 3 });
  const p = createOrder('bob smith', 'bob.smith@shop.io', 10);
  assert.deepEqual(p, { id: 2, user: 'bob smith', email: 'bob.smith@shop.io', qty: 10 });
});

test('getOrder returns stored orders and null for unknown ids', () => {
  const o = createOrder('carol', 'carol@example.com', 2);
  assert.deepEqual(getOrder(o.id), o);
  assert.equal(getOrder(999999), null);
});

test('orderCount counts successful creations only', () => {
  const before = orderCount();
  createOrder('dave', 'dave@example.com', 1);
  assert.equal(orderCount(), before + 1);
  try {
    createOrder('', 'dave@example.com', 1);
  } catch {}
  createOrder('erin', 'erin@example.com', 4);
  assert.equal(orderCount(), before + 2);
});

test('createOrder rejects bad user values with TypeError mentioning user', () => {
  for (const user of ['', undefined, null, 42, 'x'.repeat(41)]) {
    assert.throws(() => createOrder(user, 'a@b.co', 1), TypeError);
  }
  try {
    createOrder('x'.repeat(41), 'a@b.co', 1);
  } catch (e) {
    assert.match(e.message, /user/);
  }
});

test('createOrder rejects bad email values with TypeError mentioning email', () => {
  for (const email of ['nope', 'a@b', '@b.co', undefined, null, 5, 'a b@c.co']) {
    assert.throws(() => createOrder('frank', email, 1), TypeError);
  }
  try {
    createOrder('frank', 'nope');
  } catch (e) {
    assert.match(e.message, /email/);
  }
});

test('createOrder rejects bad qty values with TypeError mentioning qty', () => {
  for (const qty of [0, -1, 1.5, NaN, Infinity, '2', undefined, null]) {
    assert.throws(() => createOrder('gina', 'gina@example.com', qty), TypeError);
  }
  try {
    createOrder('gina', 'gina@example.com', 0);
  } catch (e) {
    assert.match(e.message, /qty/);
  }
});

test('createOrder validates in order: user, then email, then qty', () => {
  // All three bad: the user error wins.
  assert.throws(() => createOrder('', 'bad-email', 0), /user/);
  // User good, both email and qty bad: the email error wins.
  assert.throws(() => createOrder('hen', 'bad-email', 0), /email/);
  // User and email good: qty error surfaces.
  assert.throws(() => createOrder('hen', 'hen@example.com', 0), /qty/);
});
