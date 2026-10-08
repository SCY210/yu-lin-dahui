// Isolated fake persistence. No production reads, member credentials or D1 resets.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {mkdirSync} from 'node:fs';
mkdirSync('.test-output',{recursive:true});
await build({entryPoints:['lib/requested-event-merge.ts'],bundle:true,platform:'node',format:'esm',outfile:'.test-output/requested-merge.mjs',plugins:[{name:'fake-requested-merge',setup(builder){builder.onResolve({filter:/cloudflare:workers|(?:^|\/)store$/},args=>({path:args.path==='cloudflare:workers'?'env':'store',namespace:'fake-merge'}));builder.onLoad({filter:/.*/,namespace:'fake-merge'},args=>({loader:'js',contents:args.path==='env'?`export const env={get DB(){return globalThis.__mergeTest.enabled}};`:`export const committed=async key=>globalThis.__mergeTest.keys.has(key);export const load=async()=>structuredClone(globalThis.__mergeTest.state);export const save=async(s,key,previous)=>{const t=globalThis.__mergeTest;if(t.state.revision!==previous.revision)throw new Error('UNIQUE constraint failed: commits.revision');if(t.keys.has(key))throw new Error('UNIQUE constraint failed: commits.key');s.revision++;t.state=structuredClone(s);t.keys.add(key);t.saves++};`}))}}]});
const {runRequestedEventMerge,requestedEventMerge}=await import(pathToFileURL(resolve('.test-output/requested-merge.mjs')).href);
const start=Date.now()+7*86400000,common={title:'虚构活动',start,end:start+7200000,venue:'虚构球馆',address:'',capacity:6,signupDeadline:start,cancelDeadline:start-86400000,note:'',status:'open',courtMode:'interval',ballMode:'interval',creatorId:'owner',attendanceMode:'automatic'};
const state={revision:0,settings:{initialized:true,ownerAccountId:'owner'},accounts:[{id:'owner',playerId:'p1',role:'admin',email:''}],players:[],events:[{...common,id:requestedEventMerge.targetId},{...common,id:requestedEventMerge.sourceIds[0]},{...common,id:'excluded-deleted',deletedAt:1}],bookings:[{id:'b1',eventId:requestedEventMerge.targetId,name:'一号场',start,end:common.end,pricing:'total',cents:1000},{id:'b2',eventId:requestedEventMerge.sourceIds[0],name:'二号场',start,end:common.end,pricing:'total',cents:1000}],registrations:[],attendance:[],rounds:[],matches:[],costs:[],settlements:[],payments:[],awardVotes:[],audits:[]};
for(const [i,e]of state.events.slice(0,2).entries()){const playerId='p'+i;state.registrations.push({id:'r'+i,eventId:e.id,playerId,sequence:1,status:'confirmed',arrival:start,departure:e.end,note:'虚构测试',registeredAt:start-10000,joinedAsWaitlist:false,cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''}})}
const t=globalThis.__mergeTest={enabled:true,state:structuredClone(state),keys:new Set(),saves:0};
try{
 await Promise.all(Array.from({length:4},()=>runRequestedEventMerge()));assert.equal(t.saves,1);assert.equal(t.keys.size,1);assert.equal(t.state.events.filter(e=>e.deletedAt===undefined).length,1);assert.equal(t.state.registrations.filter(r=>r.eventId===requestedEventMerge.targetId).length,2);assert.equal(t.state.events.find(e=>e.id==='excluded-deleted').deletedAt,1);
 const after=JSON.stringify(t.state);await runRequestedEventMerge({targetId:'attacker',sourceIds:['excluded-deleted']});assert.equal(JSON.stringify(t.state),after);assert.equal(t.saves,1);
 t.keys.clear();t.state=structuredClone(state);t.state.events[1].creatorId='different-owner';const before=JSON.stringify(t.state);await assert.rejects(()=>runRequestedEventMerge(),/群主创建/);assert.equal(JSON.stringify(t.state),before);
 t.state=structuredClone(state);t.state.events=[];await runRequestedEventMerge();assert.equal(t.saves,1);
 console.log('PASS requested event migration: exact approved IDs, stored owner authorization, atomic concurrent retries, once-only ledger, no visitor parameters, deleted-event exclusion and safe missing-plan behavior');
}finally{delete globalThis.__mergeTest}
