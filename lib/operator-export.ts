/** Read-only migration capability, disabled unless a short-lived secret is configured. */
export const exportTables = [
  'accounts', 'attendance', 'audits', 'auth_rate_limits', 'auth_sessions',
  'awardVotes', 'bookings', 'challenges', 'commits', 'costs', 'events', 'matches',
  'password_credentials', 'payments', 'photos', 'players', 'push_deliveries',
  'push_jobs', 'push_subscriptions', 'ratingChanges', 'registrations',
  'reminder_inbox', 'reminder_settings', 'rounds', 'seasons', 'settings',
  'settlements', 'tagVotes', 'treasureLedger', 'treasureOrders', 'treasureProducts',
  'trial_credential_archive',
] as const;

export interface ExportEnvironment {
  DB?: D1Database;
  BUCKET?: R2Bucket;
  MIGRATION_EXPORT_TOKEN?: string;
  MIGRATION_EXPORT_EXPIRES_AT?: string;
}
const root = '/_operator/migration/';
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };
function json(value: unknown, status = 200) { return Response.json(value, { status, headers }); }
function authorized(request: Request, env: ExportEnvironment, now: number) {
  const secret = env.MIGRATION_EXPORT_TOKEN;
  const expires = Number(env.MIGRATION_EXPORT_EXPIRES_AT);
  if (!secret || !/^[a-f0-9]{64}$/.test(secret) || !Number.isFinite(expires) || expires <= now || expires > now + 86_400_000) return false;
  const supplied = request.headers.get('Authorization') ?? '';
  const expected = `Bearer ${secret}`;
  if (supplied.length !== expected.length) return false;
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= supplied.charCodeAt(i) ^ expected.charCodeAt(i);
  return difference === 0;
}

export async function operatorExport(request: Request, env: ExportEnvironment, now = Date.now()): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith(root)) return null;
  if (!authorized(request, env, now)) return json({ error: 'Not found' }, 404);
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
  try {
    if (url.pathname === `${root}snapshot`) {
      if (!env.DB) return json({ error: 'Storage unavailable' }, 503);
      // A single D1 batch is transactional: tables and schema share one snapshot.
      const queries = [
        ...exportTables.map(table => `SELECT * FROM "${table}"`),
        "SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'",
        'PRAGMA foreign_key_check',
      ];
      const results = await env.DB.batch(queries.map(sql => env.DB!.prepare(sql)));
      if (results.length !== queries.length || results.some(result => !result.success)) throw new Error('Incomplete snapshot');
      return json({ format: 'yulin-operator-snapshot-v1', capturedAt: new Date(now).toISOString(),
        tables: Object.fromEntries(exportTables.map((table, i) => [table, results[i].results])),
        schema: results[exportTables.length].results, foreignKeyViolations: results[exportTables.length + 1].results });
    }
    if (url.pathname === `${root}objects`) {
      if (!env.BUCKET) return json({ error: 'Storage unavailable' }, 503);
      const options: R2ListOptions & { include: ('httpMetadata' | 'customMetadata')[] } = {
        limit: 1000, cursor: url.searchParams.get('cursor') ?? undefined, include: ['httpMetadata', 'customMetadata'],
      };
      const page = await env.BUCKET.list(options);
      return json({ objects: page.objects.map(object => ({ key: object.key, size: object.size, etag: object.etag,
        httpMetadata: object.httpMetadata, customMetadata: object.customMetadata })), cursor: page.truncated ? page.cursor : null });
    }
    if (url.pathname === `${root}object`) {
      if (!env.BUCKET) return json({ error: 'Storage unavailable' }, 503);
      const key = url.searchParams.get('key');
      const etag = request.headers.get('If-Match');
      if (!key || !etag) return json({ error: 'Key and If-Match required' }, 400);
      const object = await env.BUCKET.get(key, { onlyIf: { etagMatches: etag } });
      if (!object) return json({ error: 'Not found' }, 404);
      if (!('body' in object)) return json({ error: 'Object changed' }, 412);
      return new Response(object.body, { headers: { ...headers, 'Content-Type': 'application/octet-stream',
        'Content-Length': String(object.size), ETag: object.httpEtag } });
    }
    return json({ error: 'Not found' }, 404);
  } catch {
    // Never log credential material, row contents, object keys, or secret values.
    return json({ error: 'Export unavailable' }, 503);
  }
}
