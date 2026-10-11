import test from 'node:test';
import assert from 'node:assert/strict';
import { usesStandaloneCloudflare } from '../build/deployment-target';
import { hostingRequest } from '../lib/hosting-request';

test('ordinary CI and Sites builds retain the existing deployment target', () => {
  assert.equal(usesStandaloneCloudflare('build', {}), false);
  assert.equal(usesStandaloneCloudflare('build', { CI: 'true' }), false);
});

test('Workers Builds selects the standalone target and explicit targets take precedence', () => {
  assert.equal(usesStandaloneCloudflare('build', { WORKERS_CI: '1' }), true);
  assert.equal(usesStandaloneCloudflare('build', { YULIN_DEPLOY_TARGET: 'cloudflare' }), true);
  assert.equal(usesStandaloneCloudflare('build', { WORKERS_CI: '1', YULIN_DEPLOY_TARGET: 'sites' }), false);
  assert.throws(() => usesStandaloneCloudflare('build', { YULIN_DEPLOY_TARGET: 'unknown' }), /YULIN_DEPLOY_TARGET/);
});

test('local development retains its local bindings even with Workers build variables', () => {
  assert.equal(usesStandaloneCloudflare('serve', { WORKERS_CI: '1', YULIN_DEPLOY_TARGET: 'cloudflare' }), false);
});

test('standalone requests discard every untrusted Sites user identity header', () => {
  const request = new Request('https://club.example/api/club', { headers: {
    'OAI-Authenticated-User-Id': 'forged-owner',
    'oai-authenticated-user-email': 'forged@example.com',
    'oai-authenticated-user-full-name': 'Forged owner',
    'oai-authenticated-user-full-name-encoding': 'percent-encoded-utf-8',
    'oai-authenticated-user-role': 'admin',
  } });
  const forwarded = hostingRequest(request, 'cloudflare');
  assert.equal([...forwarded.headers.keys()].some(name => name.startsWith('oai-authenticated-user-')), false);
  assert.equal(request.headers.get('oai-authenticated-user-id'), 'forged-owner');
});

test('standalone requests preserve password sessions, request bodies and unrelated headers', async () => {
  const request = new Request('https://club.example/api/club', { method: 'POST', headers: {
    cookie: 'yulin_session=existing-session',
    'content-type': 'application/json',
    'cf-connecting-ip': '192.0.2.1',
    'oai-authenticated-user-id': 'forged-owner',
  }, body: JSON.stringify({ action: 'register' }) });
  const forwarded = hostingRequest(request, 'cloudflare');
  assert.equal(forwarded.url, request.url);
  assert.equal(forwarded.method, 'POST');
  assert.equal(forwarded.headers.get('cookie'), 'yulin_session=existing-session');
  assert.equal(forwarded.headers.get('cf-connecting-ip'), '192.0.2.1');
  assert.deepEqual(await forwarded.json(), { action: 'register' });
});

test('Sites requests preserve the platform-provided identity and original request', () => {
  const request = new Request('https://club.example/api/club', { headers: {
    'oai-authenticated-user-id': 'platform-owner',
    'oai-authenticated-user-email': 'owner@example.com',
  } });
  assert.equal(hostingRequest(request), request);
  assert.equal(hostingRequest(request).headers.get('oai-authenticated-user-id'), 'platform-owner');
});
