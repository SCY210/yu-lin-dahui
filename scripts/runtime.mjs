import { readFileSync } from 'node:fs';

export function assertRuntime(version = process.versions.node) {
  const [major, minor] = version.split('.').map(Number);
  if (!Number.isInteger(major) || !Number.isInteger(minor) || major < 22 || (major === 22 && minor < 13)) {
    const recommended = readFileSync(new URL('../.node-version', import.meta.url), 'utf8').trim();
    throw new Error(`Node ${version} is unsupported. Use Node ${recommended}; Node >=22.13 is required for SQLite integration tests.`);
  }
}
