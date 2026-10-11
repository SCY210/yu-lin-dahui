import {spawnSync} from 'node:child_process';
import {readFileSync,lstatSync} from 'node:fs';
import {createHash} from 'node:crypto';

// Opaque fingerprints prevent deployment-only material from being published.
// Do not put private names, selectors or account identifiers in this source.
export const privateFingerprints=new Set([
 "083a301369cd711e9803f7d90d342a3778f9cb864ab22992b49fccddc3b9256c",
 "0d10e8dcab0cf4beda60220917150bbdf1f1cf2839477a4af85f304780c6bc8a",
 "1a7ac601bcf7c51cb934bc55ff81f369d94382710dad079d1a7cb0184e4af29d",
 "21fa754aff92cbaac8c31a9cb6fd76c249570a638f882d8e8a9b13c71ccd1f00",
 "597d3938db5a7d35c38fb5912dbb98d7aeb9250d826d5d86a31f6bf4c7a4ee0b",
 "72ce3f4a647f1de0767a241ac4237933b3de0eac71b82954ab7246feb201f807",
 "b1c2aa21f3c76fa6dfb658f887045df80fb7aff842749924015a67664b219ebe",
 "cfb685eeca5933543873da4541923b81a2c76c37443290470f2027081732a745",
 "db818f7caae2f912ef321c0f6d0d45e37f6a8ca048dc529b7e90ac52e7512655",
 "f4aa7403c76503c81fd251443d4f4f77dffe42758ca8816bcfb577fb48cebd07",
 "fe481ab30e3ab1f39917818b34d018db134d62f14f6c9c7a6f786f2d4b661f60"
]);
const fingerprint=value=>createHash('sha256').update(value.toLowerCase()).digest('hex');
function containsPrivate(value,fingerprints){
 const normalized=value.normalize('NFKC').replace(/([a-z0-9])([A-Z])/g,'$1 $2').toLowerCase();
 const words=normalized.match(/[a-z0-9]+|[\p{Script=Han}]+/gu)??[];
 for(let i=0;i<words.length;i++){
  for(let count=1;count<=3&&i+count<=words.length;count++)if(fingerprints.has(fingerprint(words.slice(i,i+count).join(''))))return true;
 }
 const identifiers=normalized.match(/[0-9a-f]{8}-[0-9a-f-]{27,}/g)??[];
 return identifiers.some(id=>fingerprints.has(fingerprint(id)));
}
export function findPrivateMaterial(records,fingerprints=privateFingerprints){
 return records.filter(({file,content=''})=>containsPrivate(file,fingerprints)||containsPrivate(content,fingerprints)).map(({file})=>file);
}
export function checkSharedSource(){
 const result=spawnSync('git',['ls-files','-z'],{encoding:'utf8',windowsHide:true});
 if(result.status!==0)throw new Error('Cannot inspect tracked files; push stopped.');
 const records=result.stdout.split('\0').filter(Boolean).map(file=>{
  if(lstatSync(file).isSymbolicLink())throw new Error('Shared source must not link to external files: '+file);
  return {file,content:readFileSync(file).toString('utf8')};
 });
 const rejected=findPrivateMaterial(records);
 if(rejected.length)throw new Error('Deployment-only material found; push stopped:\n'+rejected.join('\n'));
 console.log('PASS shared-source privacy: '+records.length+' tracked files checked.');
}
if(process.argv.includes('--check')){
 try{checkSharedSource()}catch(error){console.error(error.message);process.exitCode=1}
}
