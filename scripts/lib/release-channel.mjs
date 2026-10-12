import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

export function validateReleaseChannel(source,built,liveChannels){
 const configured=source.vars?.YULIN_RELEASE_CHANNEL;
 const compiled=built.vars?.YULIN_RELEASE_CHANNEL;
 if(configured!==compiled)throw new Error('Source and built release channels differ; rebuild before publishing.');
 if(liveChannels.includes('private')&&compiled!=='private')throw new Error('Production uses a private release channel. Publish from the controlled private checkout; a shared build cannot replace it.');
}

export function activeVersionIds(deployments){
 if(!Array.isArray(deployments))throw new Error('Cannot verify active deployments; publication stopped.');
 if(!deployments.length)return [];
 if(deployments.some(d=>!Number.isFinite(Date.parse(d.created_on))))throw new Error('Invalid deployment metadata; publication stopped.');
 const latest=[...deployments].sort((a,b)=>Date.parse(b.created_on)-Date.parse(a.created_on))[0];
 if(!Array.isArray(latest.versions)||!latest.versions.length||latest.versions.some(v=>typeof v.version_id!=='string'||!Number.isFinite(v.percentage)))throw new Error('Invalid active version metadata; publication stopped.');
 const active=latest.versions.filter(v=>v.percentage>0);
 if(!active.length)throw new Error('No active traffic version could be verified; publication stopped.');
 return [...new Set(active.map(v=>v.version_id))];
}

function captureNode(args,root){
 const result=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',windowsHide:true,env:{...process.env,CI:'1'}});
 if(result.error||result.status!==0)throw new Error('Cannot read the current production release policy; publication stopped.');
 return result.stdout;
}

export async function readActiveReleaseChannels({root,source,capture=async args=>captureNode(args,root)}){
 const prefix=['--import',pathToFileURL(path.join(root,'scripts','sites-env.mjs')).href,path.join(root,'node_modules','wrangler','bin','wrangler.js')];
 const suffix=['--name',source.name,'--config',path.join(root,'wrangler.cloudflare.json'),'--json'];
 const deployments=JSON.parse(await capture([...prefix,'deployments','list',...suffix]));
 const versions=await Promise.all(activeVersionIds(deployments).map(async id=>{
  const data=JSON.parse(await capture([...prefix,'versions','view',id,...suffix]));
  if(!Array.isArray(data.resources?.bindings))throw new Error('Cannot verify version bindings; publication stopped.');
  const binding=data.resources.bindings.find(b=>b.name==='YULIN_RELEASE_CHANNEL');
  if(binding&&(binding.type!=='plain_text'||typeof binding.text!=='string'))throw new Error('Cannot verify the release channel marker; publication stopped.');
  return binding?.text;
 }));
 return versions;
}
