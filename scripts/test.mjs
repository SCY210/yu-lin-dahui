import {build} from 'esbuild';
import {mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
mkdirSync('.test-output',{recursive:true});
await build({entryPoints:['tests/domain.test.ts'],bundle:true,platform:'node',format:'esm',outfile:'.test-output/domain.test.mjs'});
const r=spawnSync(process.execPath,['--test','.test-output/domain.test.mjs'],{stdio:'inherit'});process.exit(r.status??1);
