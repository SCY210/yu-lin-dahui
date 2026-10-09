import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readActionResponse } from '../lib/client/api-response';

test('action responses preserve expected API errors and reject unexpected proxy bodies', async () => {
  assert.deepEqual(await readActionResponse(Response.json({ ok: true, signedOut: true })), { ok: true, signedOut: true });
  await assert.rejects(readActionResponse(Response.json({ error: '权限不足' }, { status: 403 })), /权限不足/);
  for (const response of [new Response('<html>proxy error</html>', { status: 503 }), Response.json({ stack: 'private' }, { status: 500 }), Response.json({ ok: false }), Response.json(null)]) {
    await assert.rejects(readActionResponse(response), /服务暂不可用/);
  }
});
