// Users module: register and look up users.
// Each user: { id, name, email }
// Validation lives in src/validate.js.

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
  const user = users.get(id);
  return user === undefined ? null : user;
}

export function userCount() {
  return users.size;
}
