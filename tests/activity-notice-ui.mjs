import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import React,{act} from 'react';
import {create} from 'react-test-renderer';
import {acceptedActivityNotice} from './helpers/activity-notice.mjs';

const shell="import{createElement as h}from'react';const box=({children})=>h('section',null,children);";
await build({entryPoints:['tests/fixtures/activity-notice-harness.tsx'],outfile:'.test-output/activity-notice-ui.mjs',bundle:true,platform:'node',format:'esm',jsx:'automatic',alias:{'@':resolve('.')},external:['react','react/*','react-dom','react-dom/*'],loader:{'.css':'empty'},banner:{js:"import{createRequire}from'node:module';const require=createRequire(import.meta.url);"},plugins:[{name:'notice-dialog-shell',setup(b){
 b.onResolve({filter:/components\/ui\/(dialog|alert-dialog|checkbox)$/},a=>({path:a.path.split('/').at(-1),namespace:'notice-ui'}));
 b.onResolve({filter:/^\.\/event-share$/},()=>({path:'share',namespace:'notice-ui'}));
 b.onLoad({filter:/.*/,namespace:'notice-ui'},a=>({loader:'js',contents:a.path==='share'?"export default function Share(){return null}":a.path==='checkbox'?"import{createElement as h}from'react';export const Checkbox=props=>h('input',{type:'checkbox',...props});":shell+(a.path==='dialog'?"export const Dialog=({open,children})=>open?children:null;export const DialogContent=box,DialogHeader=box,DialogTitle=box,DialogDescription=box,DialogClose=box;":"export const AlertDialog=({open,children})=>open?children:null;export const AlertDialogContent=box,AlertDialogHeader=box,AlertDialogTitle=box,AlertDialogDescription=box,AlertDialogFooter=box,AlertDialogAction=box,AlertDialogCancel=box;")}));
}}]});
const {default:Preview,ActivityNoticeConfirmation}=await import(pathToFileURL(resolve('.test-output/activity-notice-ui.mjs')).href);
const previous=globalThis.IS_REACT_ACT_ENVIRONMENT,oldDocument=globalThis.document,oldWindow=globalThis.window;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.document={addEventListener(){},removeEventListener(){}};globalThis.window={addEventListener(){},removeEventListener(){}};
let ui;const calls=[],text=n=>typeof n==='string'?n:(Array.isArray(n)?n:n?.children??[]).map(text).join('');
const mount=async(fail=false)=>{if(ui)await act(()=>ui.unmount());await act(()=>{ui=create(React.createElement(Preview,{onAction:async(action,payload)=>{calls.push({action,payload});if(fail)throw Error('Fictional failure')}}))})};
const click=async(label,index=0)=>{const button=ui.root.findAllByType('button').filter(n=>text(n)===label)[index];assert.ok(button,label);await act(()=>button.props.onClick())};
const checkForm=()=>{assert.equal(ui.root.findByType('form').findAllByType('input').filter(n=>n.props.type==='checkbox').length,0,'actual signup contains no notice checkbox');assert.equal(ui.root.findAllByType('button').find(n=>n.props.type==='submit').props.disabled,false)};
const save=async()=>act(async()=>ui.root.findByType('form').props.onSubmit({preventDefault(){}}));
const noConsent=payload=>{assert.ok(!('noticeAccepted' in payload));assert.ok(!('noticeVersion' in payload))};
try{
 await mount();assert.ok(text(ui.toJSON()).includes('活动参与须知与风险提示'));assert.ok(ui.root.findAllByType('a').some(n=>n.props.href==='/terms'),'optional notice remains readable');
 await click('在此接龙');checkForm();await save();assert.equal(calls.at(-1).action,'courtRegister');noConsent(calls.at(-1).payload);assert.equal(calls.at(-1).payload.playerId,'self');
 await click('在此接龙',1);checkForm();await act(()=>ui.root.findByType('form').findAllByType('select')[0].props.onChange({target:{value:'friend'}}));checkForm();await save();assert.equal(calls.at(-1).payload.bookingId,'two');assert.equal(calls.at(-1).payload.playerId,'friend');noConsent(calls.at(-1).payload);
 await click('添加朋友');checkForm();await act(()=>ui.root.findByType('form').findAllByType('input').find(n=>n.props.type==='text').props.onChange({target:{value:'Fictional visitor'}}));await save();assert.equal(calls.at(-1).action,'friendSignup');assert.equal(calls.at(-1).payload.mode,'new');assert.equal(calls.at(-1).payload.name,'Fictional visitor');noConsent(calls.at(-1).payload);
 await click('代朋友接龙');checkForm();await save();assert.equal(calls.at(-1).payload.mode,'existing');assert.equal(calls.at(-1).payload.playerId,'friend');noConsent(calls.at(-1).payload);
 await mount(true);await click('在此接龙');checkForm();const count=calls.length;await save();assert.equal(calls.length,count+1);checkForm();
 await mount();await click('商品测试');const checkbox=ui.root.findByType('form').findByType('input');assert.equal(checkbox.props.checked,false);assert.equal(ui.root.findAllByType('button').find(n=>n.props.type==='submit').props.disabled,false);await save();assert.equal(calls.at(-1).payload.listed,false,'unrelated optional checkbox remains optional');
 await act(()=>ui.unmount());
 const receipt={id:'source-receipt',eventId:'source',version:acceptedActivityNotice.noticeVersion,at:Date.now(),kind:'proxy',actorName:'Fictional registrant'};
 await act(()=>{ui=create(React.createElement(ActivityNoticeConfirmation,{records:[receipt],eventId:'target',bookingId:'target-court'}))});assert.equal(ui.toJSON(),null,'no misleading missing-consent label for new signup or other event receipt');
 await act(()=>ui.update(React.createElement(ActivityNoticeConfirmation,{records:[{...receipt,eventId:'target',bookingId:'target-court'}],eventId:'target',bookingId:'target-court'})));assert.ok(text(ui.toJSON()).includes('代报名人确认'));assert.ok(text(ui.toJSON()).includes('Fictional registrant'));
 console.log('PASS activity notice UI: real self/proxy/new-friend/existing-friend signup without consent fields, readable optional notice, failure retained, historical receipt scope and empty history hidden');
}finally{if(ui)await act(()=>ui.unmount());globalThis.IS_REACT_ACT_ENVIRONMENT=previous;globalThis.document=oldDocument;globalThis.window=oldWindow}
