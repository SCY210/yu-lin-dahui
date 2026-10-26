// Real React components with fictional bounties; never contacts production.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import React from 'react';
import renderer,{act} from 'react-test-renderer';
mkdirSync('.test-output',{recursive:true});
writeFileSync('.test-output/bounty-ui-entry.ts',"export {default as BountyCard,HomeBounties} from '../app/bounty-card';export {default as BountyOffer} from '../app/bounty-offer';export {default as BountySettingsPanel} from '../app/bounty-settings';export {defaultBountySettings,drawnBounty,bountyOfferAt} from '../lib/domain/bounties';");
await build({entryPoints:['.test-output/bounty-ui-entry.ts'],outfile:'.test-output/bounty-ui.mjs',bundle:true,platform:'node',format:'esm',jsx:'automatic',alias:{'@':resolve('.')},external:['react','react/*','react-dom','react-dom/*','lucide-react'],loader:{'.css':'empty'},
 plugins:[{name:'headless-dialog',setup(b){b.onResolve({filter:/components\/ui\/dialog$/},()=>({path:'dialog',namespace:'bounty-ui'}));b.onLoad({filter:/.*/,namespace:'bounty-ui'},()=>({loader:'js',contents:"import {createElement as h} from 'react';const box=({children})=>h('section',null,children);export const Dialog=({open,children,onOpenChange})=>open?h('div',{'data-dialog':true,onClose:()=>onOpenChange(false)},children):null;export const DialogContent=box,DialogHeader=box,DialogTitle=({children})=>h('h2',null,children),DialogDescription=box;"}))}}]});
const {BountyCard,HomeBounties,BountyOffer,BountySettingsPanel,defaultBountySettings,drawnBounty,bountyOfferAt}=await import(pathToFileURL(resolve('.test-output/bounty-ui.mjs')).href);
const prior=globalThis.IS_REACT_ACT_ENVIRONMENT;globalThis.IS_REACT_ACT_ENVIRONMENT=true;let ui;
const text=node=>typeof node==='string'?node:(Array.isArray(node)?node:node?.children??[]).map(text).join('');
const mount=async(Component,props)=>{if(ui)await act(()=>ui.unmount());await act(async()=>{ui=renderer.create(React.createElement(Component,props))})};
const button=label=>ui.root.findAllByType('button').find(b=>text(b).trim()===label);
try{
 const offer={eventId:'e',playerId:'me',kind:'rout',coins:15,points:8,penalty:10},answers=[];
 await mount(BountyCard,{title:'Fictional points match',offer,onRespond:(o,accept)=>answers.push([o.eventId,accept])});
 let shown=text(ui.toJSON());assert.ok(shown.includes('大胜悬赏')&&shown.includes('个位数')&&shown.includes('15 羽币 + 8 积分')&&shown.includes('扣 10 积分')&&shown.includes('不接没有惩罚'));
 await act(()=>button('接下悬赏').props.onClick());await act(()=>button('不接').props.onClick());assert.deepEqual(answers,[['e',true],['e',false]]);
 const accepted={playerId:'me',kind:'streak',status:'accepted',at:0,coins:30,points:15,penalty:10};
 await mount(BountyCard,{accepted});assert.ok(text(ui.toJSON()).includes('进行中')&&text(ui.toJSON()).includes('活动结束后自动结算'));assert.equal(button('接下悬赏'),undefined);
 await mount(BountyCard,{accepted:{...accepted,outcome:'completed'}});assert.ok(text(ui.toJSON()).includes('悬赏完成！获得 30 羽币 + 15 积分'));
 await mount(BountyCard,{accepted:{...accepted,outcome:'failed'}});assert.ok(text(ui.toJSON()).includes('悬赏未完成，扣 10 积分'));
 await mount(BountyCard,{});assert.equal(ui.toJSON(),null);
 const popup=[];await mount(BountyOffer,{offer,title:'Fictional points match',onRespond:accept=>popup.push(accept),onLater:()=>popup.push('later')});
 assert.ok(text(ui.toJSON()).includes('悬赏令 · 大胜悬赏'));await act(()=>button('接下悬赏').props.onClick());await act(()=>ui.root.findByProps({'data-dialog':true}).props.onClose());assert.deepEqual(popup,[true,'later']);
 // Home lists the open offer, then hides accepted bounties of activities that ended more than a day ago.
 let eventId='home-0';for(let i=0;!drawnBounty(eventId,'me');i++)eventId='home-'+i;
 const start=Date.parse('2026-10-25T17:00:00Z'),event={id:eventId,title:'Fictional evening',start,end:start+7200000,status:'open',ranked:true,matchFormat:'doubles'};
 const data={events:[event],registrations:[{eventId,playerId:'me',status:'confirmed'}],matches:[],players:[{id:'me'}],settings:{bounty:defaultBountySettings},me:{playerId:'me'}};
 await mount(HomeBounties,{data,respond:()=>{},onOpen:()=>{},now:bountyOfferAt(event)});assert.ok(text(ui.toJSON()).includes('待回应'));
 await mount(HomeBounties,{data,respond:()=>{},onOpen:()=>{},now:bountyOfferAt(event)-1});assert.equal(ui.toJSON(),null,'nothing before the offer opens');
 const answered={...data,events:[{...event,bounties:[{...accepted,kind:drawnBounty(eventId,'me')}]}]};
 await mount(HomeBounties,{data:answered,respond:()=>{},onOpen:()=>{},now:start-60000});assert.ok(text(ui.toJSON()).includes('进行中'),'an accepted bounty shows before the start');
 await mount(HomeBounties,{data:answered,respond:()=>{},onOpen:()=>{},now:event.end+86400000});assert.equal(ui.toJSON(),null);
 const forms=[];await mount(BountySettingsPanel,{settings:defaultBountySettings,open:(...args)=>forms.push(args)});
 assert.ok(text(ui.toJSON()).includes('60%')&&text(ui.toJSON()).includes('30 分钟'));await act(()=>button('调整奖励与惩罚').props.onClick());
 const [,action,values,fields,convert]=forms[0];assert.equal(action,'bountySettings');assert.equal(fields.length,9);assert.equal(values.streakCoins,30);
 assert.deepEqual(convert({...values,rewards:undefined,rout:undefined,routPoints:'9',penalty:'12'}),{penalty:12,rewards:{streak:{coins:30,points:15},rout:{coins:15,points:9},upset:{coins:20,points:10},deuce:{coins:10,points:6}}});
 console.log('PASS bounty UI: offer card answers, accepted/completed/failed states, pop-up accept and later, home timing, settings form');
}finally{if(ui)await act(()=>ui.unmount());globalThis.IS_REACT_ACT_ENVIRONMENT=prior}
