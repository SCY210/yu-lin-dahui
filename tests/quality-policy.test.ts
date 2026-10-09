import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findNewDebt } from '../scripts/quality-policy.mjs';
import { assertRuntime } from '../scripts/runtime.mjs';

test('lint gate rejects new findings, changed locations and duplicate growth while allowing debt removal', () => {
  const accepted = { 'file|rule|2|original-source': 2 };
  assert.deepEqual(findNewDebt({ 'file|rule|2|original-source': 1 }, accepted), []);
  assert.deepEqual(findNewDebt({}, accepted), []);
  assert.equal(findNewDebt({ 'file|rule|2|original-source': 3 }, accepted).length, 1);
  assert.equal(findNewDebt({ 'file|rule|2|changed-source': 1 }, accepted).length, 1);
  for (const invalid of [null, [], { issue: 0 }, { issue: -1 }, { issue: NaN }]) assert.throws(() => findNewDebt(invalid, accepted));
});

test('unsupported Node fails before SQLite integration suites start', () => {
  for (const version of ['20.19.3', '22.12.0', 'invalid']) assert.throws(() => assertRuntime(version), /unsupported/);
  for (const version of ['22.13.0', '24.19.0']) assert.doesNotThrow(() => assertRuntime(version));
});
