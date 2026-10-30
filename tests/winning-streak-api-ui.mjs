import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import React,{act} from 'react';
import {create} from 'react-test-renderer';
import {sqliteD1} from './helpers/sqlite-d1.mjs';

mkdirSync('.test-output',{recursive:true});
const database=sqliteD1(),originalNow=Date.now,now=Date.parse('2026-10-12T15:00:00Z');Date.now=()=>now;
globalThis.__streakFixture={env:{DB:database.db},user:{userId:'owner',method:'password',displayName:'owner'}};
await build({stdin:{contents:`export {GET,POST} from './app/api/club/route';export {load,save} from './lib/store';export {emptyState} from './lib/domain/types';`,resolveDir:process.cwd(),loader:'ts'},outfile:'.test-output/winning-streak-api.mjs',bundle:true,platform:'node',format:'esm',plugins:[{name:'streak-fixture',setup(builder){
 builder.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'fixture'}));builder.onResolve({filter:/(?:^|\/)auth$/},()=>({path:'auth',namespace:'fixture'}));
 builder.onLoad({filter:/.*/,namespace:'fixture'},({path})=>({loader:'js',contents:path==='env'?'export const env=globalThis.__streakFixture.env;':'export const getAppUser=async()=>globalThis.__streakFixture.user;export const passwordEnabled=async()=>true;'}));
}}]});
await build({entryPoints:['app/ranking-view.tsx'],outfile:'.test-output/winning-streak-ui.mjs',bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/*','lucide-react'],loader:{'.css':'empty'},plugins:[{name:'streak-ui-shells',setup(builder){
 builder.onResolve({filter:/^\.\//},a=>a.importer.replaceAll('\\','/').endsWith('/app/ranking-view.tsx')&&!a.path.endsWith('.css')?{path:a.path,namespace:'ui'}:undefined);
 builder.onLoad({filter:/.*/,namespace:'ui'},({path})=>({loader:'js',contents:path==='./disclosure'?`export default function Disclosure({children}){return children}`:path==='./avatar'?`export const Avatar=()=>null;`:path==='./realm-badge'?`export default function Badge(){return null}export const PlacementBadge=()=>null;`:path==='./month-picker'?`export const QuarterPicker=()=>null,YearPicker=()=>null;`:`export default function Shell(){return null}`}));
}}]});
const api=await import(pathToFileURL(resolve('.test-output/winning-streak-api.mjs')).href),Ranking=(await import(pathToFileURL(resolve('.test-output/winning-streak-ui.mjs')).href)).default;
const origin='https://club.example',get=()=>api.GET(new Request(origin+'/api/club?month=2026-10&year=2026'));
const post=async(action,payload,requestId=crypto.randomUUID())=>api.POST(new Request(origin+'/api/club',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({action,payload,requestId,revision:(await api.load()).revision})}));
let renderer;const oldAct=globalThis.IS_REACT_ACT_ENVIRONMENT;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const text=n=>typeof n==='string'?n:Array.isArray(n)?n.map(text).join(''):n?.children?.map(text).join('')??'';
try{
 const s=api.emptyState(),empty=structuredClone(s);s.settings={...s.settings,initialized:true,ownerAccountId:'owner',progressionVersion:'weekly-v2',realmVersion:'elo-v1',rankingVersion:'signed-v1',scoringPolicy:'all-ranked-v1',strengthVersion:'realm-elo-v2'};
 for(let i=0;i<4;i++){const id=i?'member'+i:'owner';s.accounts.push({id,email:'',role:i?'member':'admin',playerId:'p'+i});s.players.push({id:'p'+i,name:id,ownerId:id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''})}
 const start=now-7200000;s.events.push({id:'event',creatorId:'owner',title:'Fictional streak activity',start,end:now+3600000,capacity:4,venue:'Fixture',address:'',signupDeadline:start,cancelDeadline:start,note:'',status:'live',attendanceMode:'manual',courtMode:'equal',ballMode:'equal'});
 for(let i=0;i<4;i++){const at=start+i*600000;s.rounds.push({id:'round'+i,eventId:'event',start:at,duration:10,status:'complete',eligible:['p0','p1','p2','p3'],rest:[],seed:1});s.matches.push({id:'match'+i,eventId:'event',roundId:'round'+i,courtId:'court',a:['p0','p1'],b:['p2','p3'],status:'complete',start:at,end:at+300000,scoreA:21,scoreB:10,games:[{a:21,b:10}],monthly:true,elo:true,locked:false,enteredBy:'owner'})}
 await api.save(s,'fixture-seed',empty);
 const response=await get();assert.equal(response.status,200);const initial=await response.json();
 for(const board of [initial.leaderboard,initial.quarterlyLeaderboard,initial.annualLeaderboard]){const r=board.find(r=>r.playerId==='p0');assert.deepEqual([r.points,r.matchPoints,r.streakPoints,r.pendingPoints,r.pendingGames],[18,18,6,18,4])}
 const realmBefore=initial.social.stats.find(p=>p.playerId==='p0').realmScore.score;
 await act(async()=>{renderer=create(React.createElement(Ranking,{data:initial,period:'2026-10',setPeriod(){},year:2026}))});
 assert.match(text(renderer.toJSON()),/第 2 个连续胜局另加 1 分/);assert.match(text(renderer.toJSON()),/第 3 个另加 2 分/);assert.match(text(renderer.toJSON()),/第 4 个及之后每局另加 3 分/);assert.match(text(renderer.toJSON()),/单打与双打分别累计/);
 assert.ok(!text(renderer.toJSON()).includes('连胜加分 +6'),'Compact rows do not add another line');
 const detail=renderer.root.findAllByType('button').find(b=>text(b)==='详细数据');await act(async()=>detail.props.onClick());assert.match(text(renderer.toJSON()),/连胜加分 \+6/);
 const correction={matchId:'match1',a:10,b:21,games:[{a:10,b:21}],end:s.matches[1].end,reason:'Fictional correction'};
 const key=crypto.randomUUID();assert.equal((await post('score',correction,key)).status,200);const revision=(await api.load()).revision;assert.equal((await post('score',correction,key)).status,200);assert.equal((await api.load()).revision,revision);
 let view=await (await get()).json();const corrected=view.quarterlyLeaderboard.find(r=>r.playerId==='p0');assert.deepEqual([corrected.wins,corrected.losses,corrected.streakPoints,corrected.points],[3,1,1,9]);
 assert.equal(view.social.stats.find(p=>p.playerId==='p0').realmScore.score,realmBefore,'Pending activity realm is unchanged');
 assert.equal((await post('void',{matchId:'match1',status:'cancelled',reason:'Fictional void'})).status,200);view=await (await get()).json();assert.deepEqual([view.quarterlyLeaderboard.find(r=>r.playerId==='p0').points,view.quarterlyLeaderboard.find(r=>r.playerId==='p0').streakPoints],[12,3]);
 assert.equal((await post('eventStatus',{eventId:'event',status:'ended'})).status,200);view=await (await get()).json();assert.deepEqual([view.quarterlyLeaderboard.find(r=>r.playerId==='p0').points,view.quarterlyLeaderboard.find(r=>r.playerId==='p0').pendingPoints],[12,0]);
 console.log('PASS winning-streak API/UI: SQLite projections, 0/1/2/3 pending bonus, displayed cap/reset rules, detailed subtotal, corrective replay, duplicate request, voiding and settlement without double credit');
}finally{if(renderer)await act(async()=>renderer.unmount());globalThis.IS_REACT_ACT_ENVIRONMENT=oldAct;Date.now=originalNow;database.close();delete globalThis.__streakFixture}
