import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {deployCloudflare} from './lib/cloudflare-deployment.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
try{
 const source=JSON.parse(readFileSync(path.join(root,'wrangler.cloudflare.json'),'utf8'));
 const built=JSON.parse(readFileSync(path.join(root,'dist','server','wrangler.json'),'utf8'));
 await deployCloudflare({root,source,built});
}catch(error){console.error(error instanceof Error?error.message:'Cloudflare deployment failed.');process.exitCode=1;}
