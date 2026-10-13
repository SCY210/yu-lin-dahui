import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import React from 'react';
import renderer,{act} from 'react-test-renderer';
mkdirSync('.test-output',{recursive:true});
await build({entryPoints:['app/event-awards.tsx'],bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/*','lucide-react'],loader:{'.css':'empty'},outfile:'.test-output/mvp-only-ui.mjs'});
const {default:Ballot}=await import(pathToFileURL(resolve('.test-output/mvp-only-ui.mjs')).href);
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const now=Date.now(),event={id:'fixture',creatorId:'owner',status:'ended',start:now-7200000,end:now-1000};
const data={me:{id:'member',playerId:'self',role:'member'},players:['self','alice','bob'].map(id=>({id,name:id,enabled:true})),registrations:['self','alice','bob'].map(playerId=>({eventId:event.id,playerId,status:'confirmed'})),attendance:[],matches:[],awardVotes:[]};
const sent=[],ctx={data,busy:false,async action(action,payload){sent.push({action,payload});data.awardVotes=data.awardVotes.filter(v=>v.eventId!==event.id||v.voterId!==data.me.id);if(payload.active)data.awardVotes.push({id:'own-vote',eventId:event.id,voterId:data.me.id,playerId:payload.playerId,category:'mvp',at:now});}};
const text=node=>typeof node==='string'?node:(node?.children??[]).map(text).join('');
let ui;
try{
 await act(()=>{ui=renderer.create(React.createElement(Ballot,{e:event,ctx,now}));});
 const buttons=()=>ui.root.findAllByType('button'),candidate=id=>buttons().find(b=>b.props.className?.includes('award-person')&&b.props['aria-label']?.includes(id));
 assert.equal(candidate('self').props.disabled,true);assert.equal(buttons().filter(b=>b.props.className?.includes('award-person')).length,3);
 assert.ok(!/最佳防守|最佳网前|最拼命|打法标签|四项|\/ 4/.test(text(ui.root)));
 await act(async()=>{candidate('alice').props.onClick();});assert.equal(data.awardVotes.length,1);assert.equal(sent[0].payload.category,'mvp');
 await act(async()=>{candidate('bob').props.onClick();});assert.equal(data.awardVotes.length,1);assert.equal(data.awardVotes[0].playerId,'bob');
 await act(async()=>{buttons().find(b=>text(b)==='撤回 MVP').props.onClick();});assert.equal(data.awardVotes.length,0);assert.equal(sent[2].payload.active,false);
 await act(()=>ui.update(React.createElement(Ballot,{e:{...event,status:'cancelled'},ctx,now})));
 assert.ok(buttons().filter(b=>b.props.className?.includes('award-person')).every(b=>b.props.disabled));
 data.awardVotes=[{id:'valid',eventId:event.id,voterId:'member',playerId:'alice',category:'mvp',at:now},{id:'late',eventId:event.id,voterId:'other',playerId:'bob',category:'mvp',at:event.end+25*3600000}];await act(()=>ui.update(React.createElement(Ballot,{e:{...event,status:'ended',tournament:{status:'draft'}},ctx,now:event.end+24*3600000})));assert.ok(text(ui.root).includes('本场 MVP：'));assert.ok(!/获得.*5.*积分/.test(text(ui.root)),'tournament MVP does not promise season points');assert.ok(!text(ui.root).includes('赛后开放投票'),'closed candidate cards consistently show the closed state');
 data.awardVotes=[{id:'named',eventId:event.id,voterId:'',voterPlayerId:'alice',playerId:'bob',category:'mvp',at:now}];
 for(const [me,allowed] of [[{id:'owner',playerId:'self',role:'member'},false],[{id:'member',playerId:'self',role:'member'},false],[{id:'admin',playerId:'self',role:'admin'},true],[{id:'club-owner',playerId:'self',role:'member',isOwner:true},true]]){
  data.me=me;await act(()=>ui.update(React.createElement(Ballot,{e:event,ctx,now})));
  const details=ui.root.findAllByType('details');assert.equal(details.length,allowed?1:0,'named ballot visibility follows admin/owner authority, not event ownership');
  if(allowed)assert.ok(text(details[0]).includes('alice → bob'));
  assert.ok(!text(ui.root).includes('投票为实名'),'the voting hint no longer explains who can see each vote');
 }
 console.log('PASS MVP-only ballot: self-vote/replace/withdraw/cancelled guards and named details restricted to admins and owner, including member organisers.');
}finally{if(ui)await act(()=>ui.unmount());delete globalThis.IS_REACT_ACT_ENVIRONMENT}
