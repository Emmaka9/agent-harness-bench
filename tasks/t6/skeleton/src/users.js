// Users module: register and look up users.
// Each user: { id, name, email }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isEmail(s) {
  return typeof s === 'string' && EMAIL_RE.test(s);
}

function isPositiveInt(n) {
  return typeof n === 'number' && Number.isInteger(n) && n > 0;
}

function isNonEmptyString(s, maxLen) {
  return typeof s === 'string' && s.length >= 1 && (maxLen === undefined || s.length <= maxLen);
}

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
