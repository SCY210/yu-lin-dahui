import {copyFile, mkdir, readFile, writeFile} from 'node:fs/promises';
import {constants} from 'node:fs';
import {createHash, randomUUID} from 'node:crypto';
import {resolve, join} from 'node:path';
import {pathToFileURL} from 'node:url';

export const localReportPaths=[
 'docs/MANAGED_ACCOUNTS_RESULTS.md',
 'docs/MANAGED_ACCOUNTS_RACE_RESULTS.md',
 'docs/PLAYER_PROFILE_API_RESULTS.md',
 'docs/TEST_RESULTS.md',
];

/** Copy before pulling the cleanup commit. Never delete or overwrite originals. */
export async function preserveLocalReports(root=process.cwd()){
 const archive=join(resolve(root),'.local','reports',new Date().toISOString().replaceAll(':','-')+'-'+randomUUID());
 const entries=[];
 for(const path of localReportPaths){
  const source=resolve(root,path);let bytes;
  try{bytes=await readFile(source)}catch(error){if(error.code==='ENOENT')continue;throw error}
  const target=join(archive,path);
  await mkdir(resolve(target,'..'),{recursive:true});
  await copyFile(source,target,constants.COPYFILE_EXCL);
  const saved=await readFile(target);
  const hash=value=>createHash('sha256').update(value).digest('hex');
  if(hash(saved)!==hash(bytes))throw new Error('Backup verification failed: '+path);
  entries.push({path,sha256:hash(saved)});
 }
 if(entries.length)await writeFile(join(archive,'manifest.json'),JSON.stringify({createdAt:new Date().toISOString(),entries},null,2)+'\n',{flag:'wx'});
 return {archive:entries.length?archive:null,files:entries.map(entry=>entry.path)};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const result=await preserveLocalReports();
 console.log(result.archive?'Verified local backup: '+result.archive:'No historical local reports found.');
 for(const file of result.files)console.log(file);
}
