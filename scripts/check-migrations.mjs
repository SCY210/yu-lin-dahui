import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const journal = JSON.parse(readFileSync('drizzle/meta/_journal.json', 'utf8'));
const entries = journal.entries;
const expected = entries.map(({ tag, idx }, index) => {
  if (idx !== index || !/^\d{4}_[a-zA-Z0-9_]+$/.test(tag)) throw new Error('Invalid migration ordering/name.');
  return `${tag}.sql`;
});
const actual = readdirSync('drizzle').filter(name => name.endsWith('.sql')).sort();
if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('SQL migrations and journal must match exactly.');
const digest = data => createHash('sha256').update(data.toString().replaceAll('\r\n', '\n')).digest('hex');
const frozen = JSON.parse(readFileSync('quality/migration-baseline.json', 'utf8'));
for (const [file, hash] of Object.entries(frozen)) {
  if (digest(readFileSync(`drizzle/${file}`)) !== hash) throw new Error(`Historical migration changed: ${file}. Add a new migration instead.`);
}
if (process.env.MIGRATION_BASE_REF) {
  const ref = process.env.MIGRATION_BASE_REF;
  if (!/^[a-zA-Z0-9_./-]+$/.test(ref) || ref.startsWith('-')) throw new Error('Invalid migration base ref.');
  const previous = JSON.parse(execFileSync('git', ['show', `${ref}:drizzle/meta/_journal.json`], { encoding: 'utf8' }));
  for (const { tag } of previous.entries) {
    const filename = `drizzle/${tag}.sql`;
    const old = execFileSync('git', ['show', `${ref}:${filename}`]);
    if (!expected.includes(`${tag}.sql`) || digest(readFileSync(filename)) !== digest(old)) throw new Error(`Previously committed migration changed: ${filename}`);
  }
}
console.log(`Migration history: ${expected.length} ordered SQL files, frozen historical files unchanged.`);
