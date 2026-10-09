import { build } from 'esbuild';
import { mkdirSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { assertRuntime } from './runtime.mjs';

assertRuntime();
mkdirSync('.test-output', { recursive: true });
const unitOnly = process.argv.includes('--unit');
const integrationOnly = process.argv.includes('--integration');
if (unitOnly && integrationOnly) throw new Error('Choose --unit or --integration, not both.');
function run(args) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', windowsHide: true, timeout: 180_000 });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
if (!integrationOnly) {
  const suites = readdirSync('tests').filter(name => name.endsWith('.test.ts')).sort();
  if (!suites.length) throw new Error('No unit tests found.');
  await build({ entryPoints: suites.map(name => `tests/${name}`), bundle: true, platform: 'node', format: 'esm',
    outdir: '.test-output', outExtension: { '.js': '.mjs' } });
  run(['--test', ...suites.map(name => `.test-output/${name.replace(/\.ts$/, '.mjs')}`)]);
}
if (!unitOnly) {
  // These suites run handlers locally with isolated persistence. Legacy scripts
  // requiring a running Worker are separate and must never target production.
  const suites = [
    'photo-rights-api', 'score-reminder-ui', 'install-theme-api', 'live-play-api',
    'match-scoring-api', 'point-grants-api', 'all-ranked-api', 'award-voting-api',
    'event-date-repair-api', 'settlement-api', 'requested-thursday-split-api',
    'write-retry-api', 'club-read-api', 'requested-event-merge-api',
    'trial-cleanup-api', 'push-api', 'auth-business.integration',
  ];
  for (const suite of suites) run([`tests/${suite}.mjs`]);
}

