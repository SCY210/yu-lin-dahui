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
 b.onLoad({filter:/.*/,namespace:'notice-ui'},a=>({loader:'js',contents:a.path==='checkbox'?"import{createElement as h}from'react';export const Checkbox=props=>h('input',{type:'checkbox',...props});":shell+(a.path==='dialog'?"export const Dialog=({open,children})=>open?children:null;export const DialogContent=box,DialogHeader=box,DialogTitle=box,DialogDescription=box;":"export const AlertDialog=({open,children})=>open?children:null;export const AlertDialogContent=box,AlertDialogHeader=box,AlertDialogTitle=box,AlertDialogDescription=box,AlertDialogFooter=box,AlertDialogAction=box,AlertDialogCancel=box;")}));
}}]});
const {default:Preview,ActivityNoticeConfirmation}=await import(pathToFileURL(resolve('.test-output/activity-notice-ui.mjs')).href);
const previous=globalThis.IS_REACT_ACT_ENVIRONMENT;globalThis.IS_REACT_ACT_ENVIRONMENT=true;let ui;const calls=[];
const text=n=>typeof n==='string'?n:(Array.isArray(n)?n:n?.children??[]).map(text).join('');
const mount=async(kind='self',fail=false)=>{if(ui)await act(()=>ui.unmount());await act(()=>{ui=create(React.createElement(Preview,{kind,onAction:async(action,payload)=>{calls.push({action,payload});if(fail)throw Error('Fictional failure')}}))})};
const checkbox=()=>ui.root.findAllByType('input').find(n=>n.props.type==='checkbox');
const submit=()=>ui.root.findAllByType('button').find(n=>n.props.type==='submit');
const save=async()=>act(async()=>ui.root.findByType('form').props.onSubmit({preventDefault(){}}));
try{
 await mount();assert.equal(checkbox().props.checked,false);assert.ok(submit().props.disabled);await save();assert.equal(calls.length,0,'programmatic submit also requires explicit confirmation');
 let content=text(ui.toJSON());for(const phrase of ['活动参与须知与风险提示','自愿参加与运动风险','现场安全','费用','个人资料由本人自愿填写','照片对外公开授权','2026年10月12日 · 第1版'])assert.ok(content.includes(phrase),phrase);
 assert.ok(ui.root.findAllByType('details').length>0,'full readable notice remains available inside disclosure');
 await act(()=>checkbox().props.onCheckedChange('indeterminate'));assert.ok(submit().props.disabled);
 await act(()=>checkbox().props.onCheckedChange(true));assert.equal(submit().props.disabled,false);await save();assert.equal(calls.length,1);assert.equal(calls[0].payload.noticeAccepted,true);assert.equal(calls[0].payload.noticeVersion,acceptedActivityNotice.noticeVersion);
 await act(()=>ui.root.findAllByType('button').find(n=>text(n)==='重新打开').props.onClick());assert.equal(checkbox().props.checked,false);assert.ok(submit().props.disabled,'fresh opening must never reuse prior opt-in');
 await act(()=>checkbox().props.onCheckedChange(true));await act(()=>ui.root.findAllByType('select')[0].props.onChange({target:{value:'other'}}));assert.equal(checkbox().props.checked,false);assert.ok(text(ui.toJSON()).includes('不代表朋友本人已签署'));
 await act(()=>checkbox().props.onCheckedChange(true));await act(()=>ui.root.findAllByType('select')[1].props.onChange({target:{value:'two'}}));assert.equal(checkbox().props.checked,false,'changing target court needs confirmation again');
 await mount('proxy');content=text(ui.toJSON());assert.ok(content.includes('所代报的球友'));assert.ok(content.includes('不代表朋友本人已签署'));assert.equal(checkbox().props.checked,false);
 await mount('self',true);await act(()=>checkbox().props.onCheckedChange(true));const count=calls.length;await save();assert.equal(calls.length,count+1);assert.equal(checkbox().props.checked,true,'failed save does not silently close or create another submission');
 await mount('shop');assert.equal(checkbox().props.checked,false);assert.equal(submit().props.disabled,false,'ordinary shop checkbox stays optional');await save();assert.equal(calls.at(-1).payload.listed,false);
 await act(()=>ui.unmount());
 const receipt={id:'source-receipt',eventId:'source',version:acceptedActivityNotice.noticeVersion,at:Date.now(),kind:'proxy',actorName:'Fictional registrant'};
 await act(()=>{ui=create(React.createElement(ActivityNoticeConfirmation,{records:[receipt],eventId:'target',bookingId:'target-court'}))});
 assert.ok(text(ui.toJSON()).includes('暂无须知确认记录'));assert.ok(!text(ui.toJSON()).includes('Fictional registrant'),'merged source receipt is not an agreement to target event');
 await act(()=>ui.update(React.createElement(ActivityNoticeConfirmation,{records:[{...receipt,eventId:'target',bookingId:'target-court'}],eventId:'target',bookingId:'target-court'})));
 assert.ok(text(ui.toJSON()).includes('代报名人确认'));assert.ok(text(ui.toJSON()).includes('Fictional registrant'));
 console.log('PASS activity notice UI: complete readable versioned notice, unchecked initial/reopen/retarget state, submit guard, explicit boolean opt-in, proxy disclosure, failure retained and unrelated optional checkbox unchanged');
}finally{if(ui)await act(()=>ui.unmount());globalThis.IS_REACT_ACT_ENVIRONMENT=previous}
