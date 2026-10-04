import {build} from 'esbuild';
import {mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
mkdirSync('.test-output',{recursive:true});
await build({entryPoints:['tests/domain.test.ts','tests/member-permissions.test.ts','tests/club-view.test.ts','tests/ranking-periods.test.ts'],bundle:true,platform:'node',format:'esm',outdir:'.test-output',outExtension:{'.js':'.mjs'}});
const r=spawnSync(process.execPath,['--test','.test-output/domain.test.mjs','.test-output/member-permissions.test.mjs','.test-output/club-view.test.mjs','.test-output/ranking-periods.test.mjs'],{stdio:'inherit'});process.exit(r.status??1);
