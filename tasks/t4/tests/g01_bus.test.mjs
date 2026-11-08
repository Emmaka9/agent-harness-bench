import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Bus } from '../src/bus.js';

test('g01 bus emit invokes handlers in registration order and returns the count', () => {
  const bus = new Bus();
  const order = [];
  bus.on('e', () => order.push('a'));
  bus.on('e', () => order.push('b'));
  bus.on('other', () => order.push('c'));
  assert.equal(bus.emit('e'), 2);
  assert.deepEqual(order, ['a', 'b']);
  assert.equal(bus.emit('unknown'), 0);
  assert.deepEqual(order, ['a', 'b']);
});

test('g01 bus on and off return the bus, dedupe handlers and ignore unknown offs', () => {
  const bus = new Bus();
  let n = 0;
  const h = () => {
    n++;
  };
  assert.equal(bus.on('x', h), bus);
  assert.equal(bus.off('x', h), bus);
  assert.equal(bus.listenerCount('x'), 0);
  bus.on('x', h);
  bus.on('x', h);
  assert.equal(bus.listenerCount('x'), 1);
  assert.equal(bus.emit('x'), 1);
  assert.equal(n, 1);
  bus.off('x', () => {});
  bus.off('never', h);
  assert.equal(bus.listenerCount('x'), 1);
  assert.equal(bus.listenerCount('never'), 0);
});

test('g01 emit snapshot: handlers added during emit run later, removed ones still run', () => {
  const bus = new Bus();
  const ran = [];
  const second = () => ran.push('second');
  bus.on('e', () => {
    ran.push('first');
    bus.off('e', second);
  });
  bus.on('e', second);
  assert.equal(bus.emit('e'), 2);
  assert.deepEqual(ran, ['first', 'second']);
  assert.equal(bus.listenerCount('e'), 1);
  assert.equal(bus.emit('e'), 1);
  assert.deepEqual(ran, ['first', 'second', 'first']);
  bus.on('e', () => ran.push('late'));
  assert.equal(bus.emit('e'), 2);
  assert.deepEqual(ran, ['first', 'second', 'first', 'first', 'late']);
  assert.equal(bus.listenerCount('e'), 2);
});
