// Users module using the shared validators.

import { isEmail, isNonEmptyString } from './validate.js';

const users = new Map();
let nextId = 1;

export function registerUser(name, email) {
  if (!isNonEmptyString(name, 20)) throw new TypeError('invalid user: name');
  if (!isEmail(email)) throw new TypeError('invalid user: email');
  const user = { id: nextId++, name, email };
  users.set(user.id, user);
  return user;
}

export function getUser(id) {
  return users.get(id) ?? null;
}

export function userCount() {
  return users.size;
}
