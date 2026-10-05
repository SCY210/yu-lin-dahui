import {build} from 'esbuild';
import {mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
mkdirSync('.test-output',{recursive:true});
const suites=["domain","member-permissions","club-view","ranking-periods","activity-voting","shuttles","points-plan","photo-deletion","cancellation","default-attendance","realm-progression","time-planning","navigation","event-deletion","club-refresh","request-safety","ownership","username-policy","session-sync","security-headers","image-validation","timestamp-safety","club-read-cache","pwa"];
await build({entryPoints:suites.map(name=>`tests/${name}.test.ts`),bundle:true,platform:'node',format:'esm',outdir:'.test-output',outExtension:{'.js':'.mjs'}});
const r=spawnSync(process.execPath,['--test',...suites.map(name=>`.test-output/${name}.test.mjs`)],{stdio:'inherit'});
if(r.status!==0)process.exit(r.status??1);
const readApi=spawnSync(process.execPath,['tests/club-read-api.mjs'],{stdio:'inherit'});process.exit(readApi.status??1);
