import {spawnSync} from 'node:child_process';
import {readFileSync,lstatSync} from 'node:fs';

// These names identify custom deployment material, never shared features.
const forbidden=/aquarium|粉粉水族馆|private[-_]theme|capybara|loopywalk|theme-access|queen[-_]ui[-_]theme/i;
const policyFiles=new Set(['scripts/check-shared-source.mjs','tests/shared-source.test.ts','.gitignore']);
export function findPrivateMaterial(records){
 return records.filter(({file,content=''})=>
  forbidden.test(file)||(!policyFiles.has(file)&&forbidden.test(content))
 ).map(({file})=>file);
}
export function checkSharedSource(){
 const result=spawnSync('git',['ls-files','-z'],{encoding:'utf8',windowsHide:true});
 if(result.status!==0)throw new Error('Cannot inspect tracked files; push stopped.');
 const records=result.stdout.split('\0').filter(Boolean).map(file=>{
  if(lstatSync(file).isSymbolicLink())throw new Error('Shared source must not link to external files: '+file);
  return {file,content:readFileSync(file).toString('utf8')};
 });
 const rejected=findPrivateMaterial(records);
 if(rejected.length)throw new Error('Private deployment material found; push stopped:\n'+rejected.join('\n'));
 console.log('PASS shared-source privacy: '+records.length+' tracked files checked.');
}
if(process.argv.includes('--check')){
 try{checkSharedSource()}catch(error){console.error(error.message);process.exitCode=1}
}
