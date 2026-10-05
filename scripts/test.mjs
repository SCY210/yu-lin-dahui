import {build} from 'esbuild';
import {mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
mkdirSync('.test-output',{recursive:true});
const suites=['domain','member-permissions','club-view','ranking-periods','activity-voting','default-attendance','realm-progression','time-planning','navigation','event-deletion','club-refresh','request-safety','ownership','username-policy'];
await build({entryPoints:suites.map(name=>`tests/${name}.test.ts`),bundle:true,platform:'node',format:'esm',outdir:'.test-output',outExtension:{'.js':'.mjs'}});
const r=spawnSync(process.execPath,['--test',...suites.map(name=>`.test-output/${name}.test.mjs`)],{stdio:'inherit'});process.exit(r.status??1);
