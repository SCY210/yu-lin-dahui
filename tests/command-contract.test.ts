import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { parseDomainCommand } from '../lib/domain/command-contract';

const schemas = { create: z.object({ name: z.string().trim().min(1), enabled: z.boolean().default(true) }), cancel: z.object({ id: z.string().uuid() }) };
test('command boundary rejects prototype actions and invalid payloads, applying schema transforms', () => {
  for (const action of ['__proto__', 'constructor', 'toString', 'unknown']) assert.equal(parseDomainCommand(schemas, action, {}), null);
  assert.throws(() => parseDomainCommand(schemas, 'create', null), z.ZodError);
  assert.throws(() => parseDomainCommand(schemas, 'cancel', { name: 'wrong command' }), z.ZodError);
  const parsed = parseDomainCommand(schemas, 'create', { name: ' valid ', role: 'admin' });
  assert.deepEqual(parsed, { action: 'create', payload: { name: 'valid', enabled: true } });
  if (parsed?.action === 'create') { const name: string = parsed.payload.name; assert.equal(name, 'valid'); }
});
