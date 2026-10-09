import { ESLint } from 'eslint';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertRuntime } from './runtime.mjs';
import { findNewDebt } from './quality-policy.mjs';
import { execFileSync } from 'node:child_process';

assertRuntime();
const root = fileURLToPath(new URL('../', import.meta.url));
const baselineFile = path.join(root, 'quality/lint-baseline.json');
const eslint = new ESLint({ cwd: root });
const results = await eslint.lintFiles(['.']);
const current = {};
for (const result of results) {
  const file = path.relative(root, result.filePath).replaceAll('\\', '/');
  const source = result.source ?? readFileSync(result.filePath, 'utf8');
  const lines = source.split(/\r?\n/);
  for (const message of result.messages) {
    if (message.fatal || !message.ruleId) {
      console.error(`${file}:${message.line}: ${message.message}`);
      process.exitCode = 1;
      continue;
    }
    const excerpt = lines.slice(message.line - 1, message.endLine ?? message.line).join('\n').trim();
    const hash = createHash('sha256').update(excerpt).digest('hex').slice(0, 16);
    const key = `${file}|${message.ruleId}|${message.severity}|${hash}`;
    current[key] = (current[key] ?? 0) + 1;
  }
}
const baseline = JSON.parse(readFileSync(baselineFile, 'utf8'));
if (baseline.version !== 1) throw new Error('Unsupported lint baseline version.');
if (process.env.LINT_BASE_REF) {
  const ref = process.env.LINT_BASE_REF;
  if (!/^[a-zA-Z0-9_./-]+$/.test(ref) || ref.startsWith('-')) throw new Error('Invalid lint base ref.');
  const existing = execFileSync('git', ['ls-tree', '--name-only', ref, 'quality/lint-baseline.json'], { cwd: root, encoding: 'utf8' }).trim();
  if (existing) {
    const previous = JSON.parse(execFileSync('git', ['show', `${ref}:quality/lint-baseline.json`], { cwd: root, encoding: 'utf8' }));
    if (findNewDebt(baseline.issues, previous.issues).length) throw new Error('The lint baseline may only shrink. Fix new findings instead of accepting them.');
  }
}
const newProblems = findNewDebt(current, baseline.issues);
if (newProblems.length) {
  console.error('New or changed lint debt is not allowed:');
  for (const [key, count] of newProblems) console.error(`  ${key} (+${count - (baseline.issues[key] ?? 0)})`);
  console.error((await eslint.loadFormatter('stylish')).format(results.filter(result =>
    newProblems.some(([key]) => key.startsWith(path.relative(root, result.filePath).replaceAll('\\', '/') + '|')))));
  process.exitCode = 1;
}
if (process.argv.includes('--prune') && !process.exitCode) {
  writeFileSync(baselineFile, JSON.stringify({ version: 1, issues: Object.fromEntries(Object.entries(current).sort()) }, null, 2) + '\n');
}
const total = Object.values(current).reduce((sum, count) => sum + count, 0);
console.log(`Lint: ${total} recorded legacy findings; ${newProblems.length} new/changed fingerprints. Rules remain enabled. Use npm run lint:report for the full report.`);
