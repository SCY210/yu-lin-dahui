const routeNames = new Set(['/api/club', '/api/auth', '/api/auth/legacy', '/api/photos', '/api/notifications', '/api/trial-cleanup']);

export function requestMetric(request: Request, status: number, durationMs: number, requestId: string) {
  const path = new URL(request.url).pathname;
  const route = routeNames.has(path) ? path : path.startsWith('/api/photos/') ? '/api/photos/:id' : path.startsWith('/api/theme/') ? '/api/theme/:asset' : '/other';
  const method = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'].includes(request.method) ? request.method : 'OTHER';
  return { event: 'http_request', requestId, route, method, status, durationMs: Math.max(0, Math.round(durationMs)) };
}

/** Never serialize the error message/stack, request body, cookies or account IDs. */
export function reportServerError(error: unknown, requestId: string) {
  const known = ['Error', 'TypeError', 'RangeError', 'PersistenceError'];
  const kind = error instanceof Error && known.includes(error.name) ? error.name : 'UnknownError';
  console.error(JSON.stringify({ event: 'api_failure', requestId, kind }));
}
