import {build} from 'esbuild';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

let domain;
export async function accountNoticeDomain(){
 if(!domain){
  mkdirSync('.test-output',{recursive:true});
  const output=`.test-output/account-notice-fixture-domain-${process.pid}.mjs`;
  await build({entryPoints:['lib/domain/notice-gate.ts'],bundle:true,platform:'node',format:'esm',outfile:output});
  domain=await import(pathToFileURL(resolve(output)).href);
 }
 return domain;
}

/** Explicit synthetic confirmations for existing isolated regression fixtures.
 * Call only on fictional state before its first save. This helper never connects
 * to production, runs on login, or silently accepts for a real account. Dedicated
 * account-notice-api tests deliberately do not call it, to exercise enforcement.
 */
export async function seedAccountNoticeFixture(state){
 const api=await accountNoticeDomain(),content=await api.noticeContent();
 for(const account of state.accounts){
  api.acknowledgeAccountNotice(state,account,{noticeAccepted:true,noticeVersion:content.version,noticeHash:content.contentHash},1,content);
 }
 return state;
}
