import { spawnSync } from 'node:child_process';
import { assertRuntime } from './runtime.mjs';

assertRuntime();
const checks = [
  ['Shared source privacy', ['scripts/check-shared-source.mjs', '--check']],
  ['Repository documentation and local-state policy', ['scripts/check-repository.mjs']],
  ['TypeScript', ['node_modules/typescript/bin/tsc', '--noEmit']],
  ['Lint regressions', ['scripts/lint-debt.mjs']],
  ['Migration history', ['scripts/check-migrations.mjs']],
  ['Unit and integration tests', ['scripts/test.mjs']],
  ['Production build', ['scripts/run-framework.mjs', 'build']],
];
for (const [name, args] of checks) {
  console.log(`\nVerifying: ${name}`);
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', windowsHide: true, timeout: 300_000 });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
