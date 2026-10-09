import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

test('migration check is portable across line endings and rejects edits to historical SQL', () => {
  const root = path.resolve('.test-output');
  mkdirSync(root, { recursive: true });
  const folder = mkdtempSync(path.join(root, 'migration-policy-'));
  const script = path.resolve('scripts/check-migrations.mjs');
  try {
    mkdirSync(path.join(folder, 'drizzle/meta'), { recursive: true });
    mkdirSync(path.join(folder, 'quality'), { recursive: true });
    const journal = JSON.parse(readFileSync('drizzle/meta/_journal.json', 'utf8'));
    copyFileSync('drizzle/meta/_journal.json', path.join(folder, 'drizzle/meta/_journal.json'));
    copyFileSync('quality/migration-baseline.json', path.join(folder, 'quality/migration-baseline.json'));
    for (const { tag } of journal.entries) writeFileSync(path.join(folder, `drizzle/${tag}.sql`), readFileSync(`drizzle/${tag}.sql`, 'utf8').replace(/\r?\n/g, '\r\n'));
    const options = { cwd: folder, encoding: 'utf8' as const, env: { ...process.env, MIGRATION_BASE_REF: '' }, timeout: 10_000, stdio: 'pipe' as const };
    assert.match(execFileSync(process.execPath, [script], options), /unchanged/);
    const migration = path.join(folder, `drizzle/${journal.entries[0].tag}.sql`);
    writeFileSync(migration, readFileSync(migration, 'utf8') + '\n-- unexpected historical edit\n');
    assert.throws(() => execFileSync(process.execPath, [script], options), /Historical migration changed/);
  } finally {
    if (!path.resolve(folder).startsWith(root + path.sep)) throw new Error('Unsafe test cleanup path');
    rmSync(folder, { recursive: true, force: true });
  }
});
