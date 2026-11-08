import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOrder, getOrder, orderCount } from '../src/orders.js';
import { registerUser, getUser, userCount } from '../src/users.js';

test('orders happy path', () => {
  assert.equal(orderCount(), 0);
  const o = createOrder('alice', 'alice@example.com', 3);
  assert.deepEqual(o, { id: 1, user: 'alice', email: 'alice@example.com', qty: 3 });
  assert.deepEqual(getOrder(1), o);
  assert.equal(getOrder(999), null);
  assert.equal(orderCount(), 1);
});

test('orders validation errors', () => {
  assert.throws(() => createOrder('', 'a@b.co', 1), /user/);
  assert.throws(() => createOrder('x'.repeat(41), 'a@b.co', 1), /user/);
  assert.throws(() => createOrder('bob', 'not-an-email', 1), /email/);
  assert.throws(() => createOrder('bob', 'bob@', 1), /email/);
  assert.throws(() => createOrder('bob', 'bob@example.com', 0), /qty/);
  assert.throws(() => createOrder('bob', 'bob@example.com', 1.5), /qty/);
  assert.throws(() => createOrder('bob', 'bob@example.com', '2'), /qty/);
});

test('users happy path and validation errors', () => {
  assert.equal(userCount(), 0);
  const u = registerUser('carol', 'carol@example.com');
  assert.deepEqual(u, { id: 1, name: 'carol', email: 'carol@example.com' });
  assert.deepEqual(getUser(1), u);
  assert.equal(getUser(999), null);
  assert.equal(userCount(), 1);
  assert.throws(() => registerUser('', 'a@b.co'), /name/);
  assert.throws(() => registerUser('x'.repeat(21), 'a@b.co'), /name/);
  assert.throws(() => registerUser('dan', 'dan@host'), /email/);
});
