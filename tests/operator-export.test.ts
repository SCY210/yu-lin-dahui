import test from 'node:test';
import assert from 'node:assert/strict';
import { operatorExport, exportTables, type ExportEnvironment } from '../lib/operator-export';
const now = 1_800_000_000_000;
const token = 'a'.repeat(64);
const config = { MIGRATION_EXPORT_TOKEN: token, MIGRATION_EXPORT_EXPIRES_AT: String(now + 60_000) };
const req = (path = 'snapshot', init: RequestInit = {}) => new Request(`https://test.invalid/_operator/migration/${path}`, {
  ...init, headers: { Authorization: `Bearer ${token}`, ...init.headers },
});
test('ordinary traffic continues and export is hidden without an unexpired exact token', async () => {
  assert.equal(await operatorExport(new Request('https://test.invalid/'), {}, now), null);
  for (const env of [{}, { ...config, MIGRATION_EXPORT_EXPIRES_AT: String(now) }, { ...config, MIGRATION_EXPORT_EXPIRES_AT: String(now + 86_400_001) }]) {
    assert.equal((await operatorExport(req(), env, now))!.status, 404);
  }
  for (const Authorization of ['', `Bearer ${'b'.repeat(64)}`, `Bearer ${token}extra`]) {
    assert.equal((await operatorExport(req('snapshot', { headers: { Authorization } }), config, now))!.status, 404);
  }
  assert.equal((await operatorExport(req('snapshot', { method: 'POST' }), config, now))!.status, 405);
});
test('snapshot returns full rows in one batch without running client SQL', async () => {
  const statements: string[] = [];
  let batches = 0;
  const long = 'x'.repeat(40_000);
  const DB = { prepare(sql: string) { statements.push(sql); return sql; }, async batch() {
    batches++;
    return [...exportTables.map(table => ({ success: true, results: [{ id: table, payload: long }] })),
      { success: true, results: [{ sql: 'schema' }] }, { success: true, results: [] }];
  } } as unknown as D1Database;
  const response = (await operatorExport(req('snapshot?sql=DROP%20TABLE%20accounts'), { ...config, DB }, now))!;
  assert.equal(response.status, 200);
  const result = await response.json() as { tables: Record<string, { payload: string }[]> };
  assert.equal(result.tables.password_credentials[0].payload.length, 40_000);
  assert.equal(Object.keys(result.tables).length, 32);
  assert.equal(batches, 1);
  assert.ok(statements.every(sql => !sql.includes('DROP')));
  assert.match(response.headers.get('Cache-Control')!, /no-store/);
});
test('partial database failures fail closed and do not reveal error contents', async () => {
  const DB = { prepare() {}, async batch() { throw new Error('secret sensitive rows'); } } as unknown as D1Database;
  const response = (await operatorExport(req(), { ...config, DB }, now))!;
  assert.equal(response.status, 503);
  assert.ok(!(await response.text()).includes('secret'));
});
test('configuration exports only the explicit business permission setting', async () => {
  const environment = { ...config, PROFILE_GENDER_ONLY_PLAYER_IDS: '["player-1"]', PUSH_VAPID_PRIVATE_KEY: 'never-export' };
  const response = (await operatorExport(req('configuration'), environment, now))!;
  assert.deepEqual(await response.json(), { profileGenderOnlyPlayerIds: '["player-1"]' });
});
test('object downloads require a matching source etag', async () => {
  let called = false;
  const BUCKET = { async get(key: string, options: unknown) {
    called = true;
    assert.equal(key, 'photos/a');
    assert.deepEqual(options, { onlyIf: { etagMatches: 'expected' } });
    return { size: 1, httpEtag: '"changed"' };
  } } as unknown as R2Bucket;
  const env: ExportEnvironment = { ...config, BUCKET };
  assert.equal((await operatorExport(req('object?key=photos%2Fa'), env, now))!.status, 400);
  assert.equal(called, false);
  assert.equal((await operatorExport(req('object?key=photos%2Fa', { headers: { 'If-Match': 'expected' } }), env, now))!.status, 412);
});
