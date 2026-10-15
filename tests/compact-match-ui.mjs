import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import renderer,{act} from 'react-test-renderer';
mkdirSync('.test-output',{recursive:true});
writeFileSync('.test-output/compact-match-entry.ts',"export {default as MatchCard} from '../app/match-card';export {default as GroupPlayer} from '../app/group-player';export {emptyState} from '../lib/domain/types';");
await build({entryPoints:['.test-output/compact-match-entry.ts'],bundle:true,platform:'node',format:'esm',jsx:'automatic',outfile:'.test-output/compact-match-ui.mjs',loader:{'.css':'empty'},external:['react','react/*','react-dom','react-dom/*'],banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"}});
const {MatchCard,GroupPlayer,emptyState}=await import(pathToFileURL(resolve('.test-output/compact-match-ui.mjs')).href);
const s=emptyState(),now=Date.now(),e={id:'e',creatorId:'owner',start:now-60000,end:now+3600000,status:'live',matchFormat:'doubles',venue:'Fictional court'};
s.events=[e];s.players=Array.from({length:8},(_,i)=>({id:'p'+i,name:i===0?'非常长的横向球友昵称 Test Name':'球友 '+i,rating:1000,enabled:true}));
s.accounts=[{id:'owner',role:'admin',playerId:'p0'}];s.bookings=[{id:'c1',eventId:'e',name:'1 号场'},{id:'c2',eventId:'e',name:'2 号场'}];
const m={id:'m',eventId:'e',roundId:'r',courtId:'c1',a:['p0','p1'],b:['p2','p3'],status:'published',start:null,end:null,scoreA:null,scoreB:null,monthly:true,elo:true,locked:false,games:[]};
s.matches=[m];const profiles=[],swaps=[],ctx={data:{...s,me:s.accounts[0],social:{matchLevels:{}}},name:id=>s.players.find(p=>p.id===id).name,admin:true,openProfile:id=>profiles.push(id),send(){},open(){},setDanger(){}};
const html=props=>renderToStaticMarkup(React.createElement(MatchCard,{m,ctx,...props}));
assert.equal((html({interactive:true}).match(/group-player-swap/g)??[]).length,4);
assert.ok(html({interactive:true}).includes('title="非常长的横向球友昵称 Test Name"'));
assert.equal((html({interactive:true,m:{...m,locked:true}}).match(/group-player-swap/g)??[]).length,4,'retired lock flags cannot prevent lineup edits');
const completed={...m,status:'complete',start:now-60000,end:now,scoreA:21,scoreB:18,games:[{a:21,b:18}]};
const result=html({m:completed});assert.ok(result.includes('is-complete'));assert.ok(result.includes('已完成'));assert.ok(result.includes('A 队 · 胜'));assert.ok(result.includes('比分 21 比 18'));assert.ok(result.includes('修正比分'));
assert.ok(!html({m:completed,ctx:{...ctx,readOnly:true}}).includes('修正比分'),'read-only result cards cannot correct scores');
const plannedCtx={...ctx,data:{...ctx.data,events:[{...e,schedulingMode:'planned'}],rounds:[{id:'r',eventId:'e',pointsSlot:1,status:'playing',start:now,duration:15}]}};
const unscoredPlaying=html({interactive:true,m:{...m,status:'playing',start:now,locked:true},ctx:plannedCtx});assert.equal((unscoredPlaying.match(/group-player-swap/g)??[]).length,4);assert.ok(unscoredPlaying.includes('待录分'));assert.ok(!/已锁定|锁定分组|解锁|进行中/.test(unscoredPlaying));assert.ok(html({m:completed,ctx:plannedCtx}).includes('已结束'));

globalThis.IS_REACT_ACT_ENVIRONMENT=true;let ui;
try{await act(()=>{ui=renderer.create(React.createElement(GroupPlayer,{id:'p0',ctx,interactive:true,selected:'p0',onSelect:id=>swaps.push(id)}))});
const buttons=ui.root.findAllByType('button');assert.equal(buttons[1].props['aria-pressed'],true);await act(()=>buttons[0].props.onClick());await act(()=>buttons[1].props.onClick());assert.deepEqual(profiles,['p0']);assert.deepEqual(swaps,['p0']);
await act(()=>ui.update(React.createElement(GroupPlayer,{id:'p0',ctx:{...ctx,busy:true},interactive:true})));assert.equal(ui.root.findAllByType('button')[1].props.disabled,true);
}finally{if(ui)await act(()=>ui.unmount());delete globalThis.IS_REACT_ACT_ENVIRONMENT}
// This ignored artifact uses the real components and styles for browser geometry checks.
const cards=html({interactive:true})+html({interactive:true,m:{...m,id:'m2',courtId:'c2',a:['p4','p5'],b:['p6','p7']}});
const styles=['globals.css','wuxia-theme.css','group-player.css','points-attendance.css','match-no-show.css','disclosure.css','event-live-play.css','event-scheduling.css','compact-matches.css'].map(file=>readFileSync('app/'+file,'utf8')).join('\n').replace(/@import[^;]+;/g,'');
writeFileSync('.test-output/compact-match-fixture.html',`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--border:#ddd;--card:#fff;--surface:#fff;--primary:#5444b4;--muted-foreground:#666;--accent:#eee}*{box-sizing:border-box}body{margin:0} ${styles}</style><div class="shell"><div class="event-scheduling"><details class="app-disclosure" open><summary>第 1 轮 · 已发布</summary><div class="app-disclosure-content"><div class="courts-grid">${cards}</div></div></details></div></div>`);
console.log('PASS compact match UI: full accessible names, separate profile/swap actions, selected/busy protection and ignored legacy locks, completed winner/score and read-only correction guards');
