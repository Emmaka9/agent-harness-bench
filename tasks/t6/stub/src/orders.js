// Orders module using the shared validators.

import { isEmail, isPositiveInt, isNonEmptyString } from './validate.js';

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
  return orders.get(id) ?? null;
}

export function orderCount() {
  return orders.size;
}
