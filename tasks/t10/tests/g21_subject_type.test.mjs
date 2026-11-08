import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compile, matchCount } from '../src/regex.js';

test('non-string subjects throw TypeError with the exact message', () => {
  const MSG = 'subject must be a string';
  const c = compile('a');
  for (const subject of [undefined, null, 5, {}, ['a'], true]) {
    assert.throws(
      () => c.test(subject),
      (err) => err instanceof TypeError && err.message === MSG,
      `test(${JSON.stringify(subject)})`
    );
    assert.throws(
      () => c.exec(subject),
      (err) => err instanceof TypeError && err.message === MSG,
      `exec(${JSON.stringify(subject)})`
    );
    assert.throws(
      () => matchCount('a', subject),
      (err) => err instanceof TypeError && err.message === MSG,
      `matchCount(${JSON.stringify(subject)})`
    );
  }
  assert.equal(matchCount('a', ''), 0);
});
