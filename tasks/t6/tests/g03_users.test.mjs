import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { registerUser, getUser, userCount } from '../src/users.js';
import { createOrder, getOrder, orderCount } from '../src/orders.js';

const srcDir = path.join(path.dirname(url.fileURLToPath(import.meta.url)), '..', 'src');

test('registerUser builds the same record shape as before', () => {
  const u = registerUser('carol', 'carol@example.com');
  assert.deepEqual(u, { id: 1, name: 'carol', email: 'carol@example.com' });
  const v = registerUser('dave', 'dave@shop.io');
  assert.deepEqual(v, { id: 2, name: 'dave', email: 'dave@shop.io' });
});

test('getUser returns stored users and null for unknown ids', () => {
  const u = registerUser('erin', 'erin@example.com');
  assert.deepEqual(getUser(u.id), u);
  assert.equal(getUser(424242), null);
});

test('registerUser rejects bad name values with TypeError mentioning name', () => {
  for (const name of ['', undefined, null, 7, 'x'.repeat(21)]) {
    assert.throws(() => registerUser(name, 'a@b.co'), TypeError);
  }
  try {
    registerUser('x'.repeat(21), 'a@b.co');
  } catch (e) {
    assert.match(e.message, /name/);
  }
});

test('registerUser rejects bad email values with TypeError mentioning email', () => {
  for (const email of ['nope', 'a@b', 'a b@b.co', undefined, null, 5]) {
    assert.throws(() => registerUser('finn', email), TypeError);
  }
  try {
    registerUser('finn', 'nope');
  } catch (e) {
    assert.match(e.message, /email/);
  }
});

test('registerUser validates in order: name, then email', () => {
  assert.throws(() => registerUser('', 'bad-email'), /name/);
  assert.throws(() => registerUser('good-name', 'bad-email'), /email/);
});

test('users and orders keep separate registries', () => {
  const usersBefore = userCount();
  const u = registerUser('solo', 'solo@example.com');
  const o = createOrder('solo', 'solo@example.com', 1);
  assert.equal(userCount(), usersBefore + 1);
  assert.deepEqual(getUser(u.id), u);
  assert.notEqual(getUser(u.id), o);
});

test('call-site modules contain no duplicated validation logic', () => {
  for (const file of ['orders.js', 'users.js']) {
    const text = fs.readFileSync(path.join(srcDir, file), 'utf8');
    assert.doesNotMatch(text, /EMAIL_RE|new RegExp|\[\^\\s@\]/, `${file} must not keep an email regex`);
    assert.doesNotMatch(text, /Number\.isInteger/, `${file} must not keep an integer check`);
    assert.doesNotMatch(text, /\.length\s*(>=|<=|>|<)/, `${file} must not keep an inline length check`);
    assert.match(text, /from\s+'\.\//, `${file} must import from a sibling module`);
  }
  const validate = fs.readFileSync(path.join(srcDir, 'validate.js'), 'utf8');
  assert.match(validate, /export function isEmail/);
  assert.match(validate, /export function isPositiveInt/);
  assert.match(validate, /export function isNonEmptyString/);
});
