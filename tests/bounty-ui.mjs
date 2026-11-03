// Real React components with fictional bounties; never contacts production.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import React from 'react';
import renderer,{act} from 'react-test-renderer';
mkdirSync('.test-output',{recursive:true});
writeFileSync('.test-output/bounty-ui-entry.ts',"export {default as BountyCard,HomeBounties} from '../app/bounty-card';export {default as BountyOffer} from '../app/bounty-offer';export {default as BountySettingsPanel} from '../app/bounty-settings';export {default as BountyHonorBanner} from '../app/bounty-honor-banner';export {defaultBountySettings,drawnBounty,bountyOfferAt,bountyKinds} from '../lib/domain/bounties';export {bountyEffects} from '../app/bounty-effects';");
await build({entryPoints:['.test-output/bounty-ui-entry.ts'],outfile:'.test-output/bounty-ui.mjs',bundle:true,platform:'node',format:'esm',jsx:'automatic',alias:{'@':resolve('.')},external:['react','react/*','react-dom','react-dom/*','lucide-react'],loader:{'.css':'empty'},
 plugins:[{name:'headless-dialog',setup(b){b.onResolve({filter:/components\/ui\/dialog$/},()=>({path:'dialog',namespace:'bounty-ui'}));b.onLoad({filter:/.*/,namespace:'bounty-ui'},()=>({loader:'js',contents:"import {createElement as h} from 'react';const box=({children})=>h('section',null,children);export const Dialog=({open,children,onOpenChange})=>open?h('div',{'data-dialog':true,onClose:()=>onOpenChange(false)},children):null;export const DialogContent=box,DialogHeader=box,DialogTitle=({children})=>h('h2',null,children),DialogDescription=box;"}))}}]});
const {BountyCard,HomeBounties,BountyOffer,BountySettingsPanel,BountyHonorBanner,defaultBountySettings,drawnBounty,bountyOfferAt,bountyKinds,bountyEffects}=await import(pathToFileURL(resolve('.test-output/bounty-ui.mjs')).href);
const prior=globalThis.IS_REACT_ACT_ENVIRONMENT;globalThis.IS_REACT_ACT_ENVIRONMENT=true;let ui;
const text=node=>typeof node==='string'?node:(Array.isArray(node)?node:node?.children??[]).map(text).join('');
const mount=async(Component,props)=>{if(ui)await act(()=>ui.unmount());await act(async()=>{ui=renderer.create(React.createElement(Component,props))})};
const button=label=>ui.root.findAllByType('button').find(b=>text(b).trim()===label);
try{
 const offer={eventId:'e',playerId:'me',kind:'rout',coins:15,points:8,penalty:10},answers=[];
 await mount(BountyCard,{title:'Fictional points match',offer,onRespond:(o,accept)=>answers.push([o.eventId,accept])});
 let shown=text(ui.toJSON());assert.ok(shown.includes('大胜悬赏')&&shown.includes('个位数')&&shown.includes('15 羽币 + 8 积分')&&shown.includes('折损 10 积分')&&shown.includes('婉拒无罚'));
 await act(()=>button('接下此令').props.onClick());await act(()=>button('婉拒').props.onClick());assert.deepEqual(answers,[['e',true],['e',false]]);
 const accepted={playerId:'me',kind:'streak',status:'accepted',at:0,coins:30,points:15,penalty:10};
 await mount(BountyCard,{accepted});assert.ok(text(ui.toJSON()).includes('修行中')&&text(ui.toJSON()).includes('天机阁自会清算'));assert.equal(button('接下此令'),undefined);
 await mount(BountyCard,{accepted:{...accepted,outcome:'completed'}});assert.ok(text(ui.toJSON()).includes('悬赏功成！天机阁赐下 30 羽币 + 15 积分'));
 await mount(BountyCard,{accepted:{...accepted,outcome:'failed'}});assert.ok(text(ui.toJSON()).includes('此令未竟，折损 10 积分'));
 await mount(BountyCard,{});assert.equal(ui.toJSON(),null);
 const popup=[];await mount(BountyOffer,{offer,title:'Fictional points match',onRespond:accept=>popup.push(accept),onLater:()=>popup.push('later')});
 assert.ok(text(ui.toJSON()).includes('天机阁降下大胜悬赏')&&text(ui.toJSON()).includes('道友可敢接下'));await act(()=>button('接下此令').props.onClick());await act(()=>ui.root.findByProps({'data-dialog':true}).props.onClose());assert.deepEqual(popup,[true,'later']);
 // Every bounty kind pops up its own scene: its own class, seal word and name, hidden from screen readers.
 const scenes=[];for(const kind of bountyKinds){await mount(BountyOffer,{offer:{...offer,kind},title:'Fictional points match',onRespond:()=>{},onLater:()=>{}});const fx=ui.root.findByProps({'data-kind':kind,'aria-hidden':'true'});assert.equal(fx.props.className,'bounty-fx bounty-fx-'+kind);assert.ok(text(fx).includes(bountyEffects[kind].word)&&text(fx).includes(bountyEffects[kind].name));assert.equal(ui.root.findAll(n=>n.props.className==='bounty-offer-seal').length,0);scenes.push(text(fx))}
 assert.equal(new Set(scenes).size,8,'eight different scenes');assert.equal(new Set(bountyKinds.map(k=>bountyEffects[k].word)).size,8);
 const fxCss=readFileSync('app/bounty-effects.css','utf8');for(const name of ['fx-sword-in','fx-strike','fx-leap','fx-rush-left','fx-stamp','fx-bell-drop','fx-swell','fx-sweep-turn','fx-blade-left'])assert.ok(fxCss.includes('@keyframes '+name),name);
 assert.ok(fxCss.includes('@media (prefers-reduced-motion:reduce){')&&fxCss.includes('.bounty-fx *,.bounty-fx *::after{animation:none!important}'),'reduced motion shows the final frame still');
 // Home lists the open offer, then hides accepted bounties of activities that ended more than a day ago.
 let eventId='home-0';for(let i=0;!drawnBounty(eventId,'me');i++)eventId='home-'+i;
 const start=Date.parse('2026-10-25T17:00:00Z'),event={id:eventId,title:'Fictional evening',start,end:start+7200000,status:'open',ranked:true,matchFormat:'doubles'};
 const data={events:[event],registrations:[{eventId,playerId:'me',status:'confirmed'}],matches:[],players:[{id:'me'}],settings:{bounty:defaultBountySettings},me:{playerId:'me'}};
 await mount(HomeBounties,{data,respond:()=>{},onOpen:()=>{},now:bountyOfferAt(event)});assert.ok(text(ui.toJSON()).includes('待接令'));
 await mount(HomeBounties,{data,respond:()=>{},onOpen:()=>{},now:bountyOfferAt(event)-1});assert.equal(ui.toJSON(),null,'nothing before the offer opens');
 const answered={...data,events:[{...event,bounties:[{...accepted,kind:drawnBounty(eventId,'me')}]}]};
 await mount(HomeBounties,{data:answered,respond:()=>{},onOpen:()=>{},now:start-60000});assert.ok(text(ui.toJSON()).includes('修行中'),'an accepted bounty shows before the start');
 await mount(HomeBounties,{data:answered,respond:()=>{},onOpen:()=>{},now:event.end+86400000});assert.equal(ui.toJSON(),null);
 const forms=[];await mount(BountySettingsPanel,{settings:defaultBountySettings,open:(...args)=>forms.push(args)});
 assert.ok(text(ui.toJSON()).includes('30%')&&text(ui.toJSON()).includes('30 分钟'));await act(()=>button('调整奖励与惩罚').props.onClick());
 const [,action,values,fields,convert]=forms[0];assert.equal(action,'bountySettings');assert.equal(fields.length,bountyKinds.length*2+1);assert.equal(values.streakCoins,30);
 assert.deepEqual(convert({...values,rewards:undefined,rout:undefined,routPoints:'9',penalty:'12'}),{penalty:12,rewards:{...defaultBountySettings.rewards,rout:{coins:15,points:9}}});
 // The club-wide banner announces completed bounties in the cultivation voice, opens the activity and can be closed.
 const honors=[{eventId:'h1',title:'Fictional evening',playerId:'p1',kind:'streak',coins:30,points:15,at:2},{eventId:'h2',title:'Fictional morning',playerId:'p2',kind:'deuce',coins:10,points:0,at:1}],opened=[];
 await mount(BountyHonorBanner,{honors,name:id=>({p1:'Ada',p2:'Bo'})[id],onOpen:id=>opened.push(id)});
 const banner=ui.root.findByProps({'aria-label':'悬赏捷报'}),lists=banner.findAll(n=>n.type==='ul');
 assert.equal(lists.length,2,'a second copy makes the scroll seamless');assert.equal(lists[1].props['aria-hidden'],true,'the copy is hidden from screen readers');
 shown=text(lists[0]);assert.ok(shown.includes('天机阁传讯：「Fictional evening」一役，Ada道友连斩五阵，剑气如虹，揭下连胜悬赏，得赏 30 羽币 + 15 积分！'),shown);assert.ok(shown.includes('Bo道友')&&shown.includes('鏖战悬赏')&&shown.includes('得赏 10 羽币！'));
 await act(()=>lists[0].findAllByType('button')[1].props.onClick());assert.deepEqual(opened,['h2']);
 await act(()=>ui.root.findByProps({'aria-label':'收起悬赏捷报'}).props.onClick());assert.equal(ui.toJSON(),null,'closed for this visit');
 await mount(BountyHonorBanner,{honors:[],name:()=>'',onOpen:()=>{}});assert.equal(ui.toJSON(),null,'nothing to announce');
 const honorCss=readFileSync('app/bounty-honor-banner.css','utf8');assert.ok(honorCss.includes('@keyframes bounty-honor-scroll')&&honorCss.includes('@media (prefers-reduced-motion:reduce){'),'scrolls, and stands still for reduced motion');
 console.log('PASS bounty UI: club-wide honour banner, offer card answers, accepted/completed/failed states, pop-up accept and later, a different xianxia scene per bounty kind with a still final frame for reduced motion, home timing, settings form');
}finally{if(ui)await act(()=>ui.unmount());globalThis.IS_REACT_ACT_ENVIRONMENT=prior}
