import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {readActiveReleaseChannels,validateReleaseChannel} from './release-channel.mjs';

export const schemaDeploymentMessage='D1 migrations applied before Worker publish';
export function validateCloudflareBuild(source,built){
 const configured=source.d1_databases?.find(item=>item.binding==='DB');
 const compiled=built.d1_databases?.find(item=>item.binding==='DB');
 if(!configured?.database_id||configured.database_id==='00000000-0000-4000-8000-000000000000')throw new Error('Configure a real standalone D1 database before deployment.');
 if(built.vars?.YULIN_HOSTING_PROVIDER!=='cloudflare'||source.name!==built.name||compiled?.database_id!==configured.database_id)throw new Error('Build the standalone Cloudflare target before deployment; the generated Worker and D1 binding must match.');
}

function runNode(args,root){
 const result=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit',windowsHide:true,env:{...process.env,CI:'1'}});
 if(result.error)throw result.error;
 if(result.status!==0)throw new Error(`Deployment stopped: command exited with ${result.status??1}.`);
}

/** Publish is unreachable until migration history validation and remote migrations succeed. */
export async function deployCloudflare({root,source,built,run=args=>runNode(args,root),readChannels=()=>readActiveReleaseChannels({root,source})}){
 validateCloudflareBuild(source,built);
 validateReleaseChannel(source,built,await readChannels());
 const wrangler=path.join(root,'node_modules','wrangler','bin','wrangler.js');
 const prefix=['--import',pathToFileURL(path.join(root,'scripts','sites-env.mjs')).href,wrangler];
 await run([path.join(root,'scripts','check-migrations.mjs')]);
 await run([...prefix,'d1','migrations','apply','DB','--remote','--config',path.join(root,'wrangler.cloudflare.json')]);
 await run([...prefix,'deploy','--config',path.join(root,'dist','server','wrangler.json'),'--message',schemaDeploymentMessage]);
}
