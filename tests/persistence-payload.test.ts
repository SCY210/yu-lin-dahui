import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStoredObject, PersistenceError } from '../lib/persistence-payload';
import { publicApiError } from '../lib/api-error';

test('corrupt stored JSON is a server error and never reveals the stored contents', () => {
  for (const value of ['{"secret":"private-password"', 'null', '[]', '123']) {
    assert.throws(() => parseStoredObject(value, 'players'), error => {
      assert.ok(error instanceof PersistenceError);
      const safe = publicApiError(error);
      assert.equal(safe.status, 503);
      assert.ok(!JSON.stringify(safe).includes('private-password'));
      return true;
    });
  }
});
