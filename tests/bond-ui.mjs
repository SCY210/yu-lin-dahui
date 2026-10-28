// Real bond card and gift popup with fictional members; never contacts production.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import React,{act} from 'react';
import renderer from 'react-test-renderer';

mkdirSync('.test-output',{recursive:true});
writeFileSync('.test-output/bond-ui-entry.ts',"export {default as BondCard} from '../app/bond-card';export {default as GiftPopup} from '../app/gift-popup';");
const shell=`import {createElement as h} from 'react';const box=({children})=>h('section',null,children);const heading=({children})=>h('h2',null,children);`;
await build({entryPoints:['.test-output/bond-ui-entry.ts'],outfile:'.test-output/bond-ui.mjs',bundle:true,platform:'node',format:'esm',jsx:'automatic',alias:{'@':resolve('.')},external:['react','react/*','react-dom','react-dom/*','lucide-react'],loader:{'.css':'empty'},plugins:[{name:'dialog',setup(b){
 b.onResolve({filter:/components\/ui\/dialog$/},()=>({path:'dialog',namespace:'bond-ui'}));
 b.onLoad({filter:/.*/,namespace:'bond-ui'},()=>({loader:'js',contents:shell+`export const Dialog=({open,children})=>open?children:null;export const DialogContent=box,DialogHeader=box,DialogTitle=heading,DialogDescription=box;`}));
}}]});
const {BondCard,GiftPopup}=await import(pathToFileURL(resolve('.test-output/bond-ui.mjs')).href);
const prior=globalThis.IS_REACT_ACT_ENVIRONMENT;globalThis.IS_REACT_ACT_ENVIRONMENT=true;let ui;
const text=node=>typeof node==='string'?node:(Array.isArray(node)?node:node?.children??[]).map(text).join('');
const mount=async(Component,props)=>{if(ui)await act(()=>ui.unmount());await act(async()=>{ui=renderer.create(React.createElement(Component,props))})};
const button=label=>ui.root.findAllByType('button').find(b=>text(b).includes(label));
try{
 const forms=[],friend={id:'p2',name:'Fictional Ben',enabled:true};
 const ctx=(bonds,products=[{id:'tape',name:'Fictional grip tape',price:12,stock:3,active:true},{id:'gone',name:'Sold out',price:5,stock:0,active:true}])=>({busy:false,open:(...args)=>forms.push(args),data:{bonds,treasureShop:{products}}});
 await mount(BondCard,{p:friend,ctx:ctx({rows:[{playerId:'p2',score:6200,games:40,wins:22,giftsSent:30,giftsReceived:0}],giftable:25})});
 let shown=text(ui.toJSON());
 for(const part of ['我和 Fictional Ben 的羁绊','朝夕相处','6,200','距「风雨同舟」还差 8,800','默契加成 ×4','一起搭档每局 +240','赢球再 +160','40 局 · 赢 22 局','送出 30 · 收到 0 羽币','莫逆之交'])assert.ok(shown.includes(part),part);
 assert.equal(ui.root.findAll(n=>n.props?.className==='bond-current').length,1,'the stage table marks the current stage');
 await act(()=>button('送羽币').props.onClick());
 let [title,action,values,fields,convert]=forms.at(-1);
 assert.equal(title,'送羽币给 Fictional Ben');assert.equal(action,'bondGift');assert.equal(values.coins,10);assert.equal(fields[0].max,25);
 assert.deepEqual(convert({coins:'7',message:' 谢谢 '}),{toPlayerId:'p2',coins:7,message:'谢谢'});
 await act(()=>button('送礼物').props.onClick());
 [title,action,values,fields,convert]=forms.at(-1);
 assert.equal(action,'treasureRedeem');assert.deepEqual(fields[0].options,[['tape','Fictional grip tape · 12 羽币']],'only products in stock');
 assert.deepEqual(convert({productId:'tape',quantity:'2',message:''}),{productId:'tape',quantity:2,expectedPrice:12,giftTo:'p2',message:''});
 await mount(BondCard,{p:friend,ctx:ctx({rows:[],giftable:0},[])});
 shown=text(ui.toJSON());
 assert.ok(shown.includes('萍水相逢')&&shown.includes('距「泛泛之交」还差 300'),'a pair without history starts at 萍水相逢');
 assert.equal(button('送羽币').props.disabled,true);assert.equal(button('送礼物').props.disabled,true);
 assert.ok(shown.includes('暂时没有可赠送的羽币')&&shown.includes('暂时没有可送的礼品'));
 await mount(BondCard,{p:friend,ctx:ctx({rows:[{playerId:'p2',score:600000,games:900,wins:500,giftsSent:0,giftsReceived:0}],giftable:5})});
 assert.ok(text(ui.toJSON()).includes('已达最高阶段'));
 await mount(BondCard,{p:{...friend,guestEventId:'e'},ctx:ctx({rows:[],giftable:5})});
 assert.equal(button('送羽币'),undefined,'no gifts for guests');

 const acknowledged=[],names={p1:'Fictional Ann',p3:'Fictional Cai'};
 const notices=[{id:'g1',fromPlayerId:'p1',coins:30,value:30,message:'谢谢搭档',at:1},{id:'g2',fromPlayerId:'p3',coins:0,item:'Fictional grip tape × 2',value:24,at:2}];
 const props={notices,name:id=>names[id],busy:false,blocked:false,acknowledge:async ids=>{acknowledged.push(ids)}};
 await mount(GiftPopup,props);shown=text(ui.toJSON());
 for(const part of ['你收到了 2 份礼物！','羁绊好感度共 +2,700','Fictional Ann 送你 30 羽币','谢谢搭档','Fictional Cai 送你：Fictional grip tape × 2','由群主发放'])assert.ok(shown.includes(part),part);
 await act(()=>button('收下礼物').props.onClick());
 assert.deepEqual(acknowledged,[['g1','g2']]);assert.equal(ui.toJSON(),null,'closes at once');
 await mount(GiftPopup,{...props,blocked:true});assert.equal(ui.toJSON(),null,'waits behind other popups');
 console.log('PASS bond card and gift popup UI: stage, progress, boost, gift forms and payloads, empty and top stages, guests, gift notice acknowledgement');
}finally{if(ui)await act(()=>ui.unmount());globalThis.IS_REACT_ACT_ENVIRONMENT=prior}
