import {build} from 'esbuild';
import {mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
mkdirSync('.test-output',{recursive:true});
await build({entryPoints:['tests/navigation.test.ts'],bundle:true,platform:'node',format:'esm',outfile:'.test-output/navigation.test.mjs'});
const result=spawnSync(process.execPath,['--test','.test-output/navigation.test.mjs'],{stdio:'inherit'});process.exit(result.status??1);
