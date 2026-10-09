import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requestMetric, reportServerError } from '../lib/observability';

test('request metrics and server errors omit personal identifiers, query strings and secrets', () => {
  const request = new Request('https://club.example/api/photos/private-member-id?token=private-token', {
    method: 'POST', headers: { cookie: 'private-cookie' }, body: 'private-password',
  });
  const metric = requestMetric(request, 503, 23.6, 'random-request-id');
  assert.deepEqual(metric, { event: 'http_request', requestId: 'random-request-id', route: '/api/photos/:id', method: 'POST', status: 503, durationMs: 24 });
  const captured: string[] = [], original = console.error;
  try {
    console.error = (message: string) => { captured.push(message); };
    reportServerError(new Error('private-password SQL private-member-id'), 'random-request-id');
  } finally { console.error = original; }
  assert.deepEqual(JSON.parse(captured[0]), { event: 'api_failure', requestId: 'random-request-id', kind: 'Error' });
  assert.ok(!JSON.stringify({ metric, captured }).includes('private-'));
});
