// Orders module: create and look up orders.
// Each order: { id, user, email, qty }

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

const orders = new Map();
let nextId = 1;

export function createOrder(user, email, qty) {
  if (!isNonEmptyString(user, 40)) throw new TypeError('invalid order: user');
  if (!isEmail(email)) throw new TypeError('invalid order: email');
  if (!isPositiveInt(qty)) throw new TypeError('invalid order: qty');
  const order = { id: nextId++, user, email, qty };
  orders.set(order.id, order);
  return order;
}

export function getOrder(id) {
  const order = orders.get(id);
  return order === undefined ? null : order;
}

export function orderCount() {
  return orders.size;
}
