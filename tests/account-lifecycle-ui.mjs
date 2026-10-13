import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import React, {act} from 'react';
import {create} from 'react-test-renderer';

await build({stdin: {contents: `export {default as Controls} from './app/account-controls';export {AccountControlsContext} from './lib/client/account-controls-context';export {MySettings} from './app/me-panels';`, resolveDir: process.cwd(), loader: 'tsx'}, outfile: '.test-output/account-lifecycle-ui.mjs', bundle: true, platform: 'node', format: 'esm', jsx: 'automatic', alias: {'@':resolve('.')}, external: ['react','react/*','lucide-react'], loader: {'.css':'empty'}, plugins: [{name: 'lifecycle-ui-shells', setup(builder) {
  builder.onResolve({filter: /components\/ui\/dialog$/}, () => ({path:'dialog',namespace:'fixture'}));
  builder.onResolve({filter: /^sonner$/}, () => ({path:'toast',namespace:'fixture'}));
  builder.onResolve({filter: /client\/session-sync$/}, () => ({path:'session',namespace:'fixture'}));
  builder.onLoad({filter: /.*/, namespace:'fixture'}, ({path}) => ({loader:'js', contents: path==='dialog' ? `import {createElement} from 'react';export const Dialog=({open,children})=>open?children:null;export const DialogContent=({children,...props})=>createElement('section',{...props,role:'dialog'},children);export const DialogHeader=({children})=>children;export const DialogTitle=({children})=>createElement('h2',null,children);export const DialogDescription=({children})=>createElement('p',null,children);` : path==='toast' ? 'export const toast={success(){}};' : 'export function notifySessionChange(){globalThis.__lifecycleUi.signals++}'}));
}}]});
const {Controls,MySettings,AccountControlsContext}=await import(pathToFileURL(resolve('.test-output/account-lifecycle-ui.mjs')).href);
const previous={fetch:globalThis.fetch,storage:globalThis.sessionStorage,location:globalThis.location,act:globalThis.IS_REACT_ACT_ENVIRONMENT};
const fixture=globalThis.__lifecycleUi={signals:0,redirect:null,requests:[],refreshes:0};
globalThis.IS_REACT_ACT_ENVIRONMENT=true;const storage=new Map();
globalThis.sessionStorage={setItem:(key,value)=>storage.set(key,value)};
globalThis.location={replace:url=>{fixture.redirect=url}};
let resolveRequest, renderer;
globalThis.fetch=(_url,options)=>{fixture.requests.push(JSON.parse(options.body));return new Promise(resolve=>{resolveRequest=resolve})};
const text=n=>typeof n==='string'?n:Array.isArray(n)?n.map(text).join(''):n?.children?.map(text).join('')??'';
const button=label=>renderer.root.findAllByType('button').find(n=>text(n).trim()===label);
async function click(label){await act(async()=>{assert.ok(button(label),label);button(label).props.onClick()})}
const props={isOwner:false,role:'admin',method:'password',refresh:async()=>{fixture.refreshes++}};
try {
  await act(async()=>{renderer=create(React.createElement(AccountControlsContext.Provider,{value:props},React.createElement(MySettings,{account:React.createElement('p',null,'Login settings'),notifications:React.createElement('p',null,'Notifications')})))});
  assert.equal(button('注销我的账号'),undefined,'Controls mount only in account settings');
  await click('账号与密码');assert.ok(button('注销我的账号'));assert.ok(button('放弃管理员权限'));
  await click('放弃管理员权限');assert.match(text(renderer.toJSON()),/无需群主审批/);
  assert.equal(button('确认放弃权限').props.disabled,true);
  await act(async()=>{renderer.root.findByProps({type:'password'}).props.onChange({target:{value:'fixture-password'}});renderer.root.findByProps({type:'checkbox'}).props.onChange({target:{checked:true}})});
  let submission;await act(async()=>{submission=renderer.root.findByType('form').props.onSubmit({preventDefault(){}});await Promise.resolve()});
  assert.equal(button('正在处理…').props.disabled,true);assert.equal(renderer.root.findByProps({role:'dialog'}).props.showCloseButton,false);
  assert.equal(fixture.requests[0].action,'relinquishAdmin');assert.equal(fixture.requests[0].currentPassword,'fixture-password');assert.equal(fixture.requests[0].confirmed,true);assert.equal(fixture.requests[0].accountId,undefined);
  await act(async()=>{resolveRequest(Response.json({ok:true}));await submission});assert.equal(fixture.refreshes,1);
  await click('注销我的账号');assert.match(text(renderer.toJSON()),/30天内重新登录/);assert.match(text(renderer.toJSON()),/导出副本和备份不在自动清理范围/);
  await act(async()=>{renderer.root.findByProps({type:'password'}).props.onChange({target:{value:'fixture-password'}});renderer.root.findByProps({type:'checkbox'}).props.onChange({target:{checked:true}})});
  await act(async()=>{submission=renderer.root.findByType('form').props.onSubmit({preventDefault(){}});await Promise.resolve()});
  const deleteAfter=Date.now()+30*86400000;
  await act(async()=>{resolveRequest(Response.json({ok:true,signedOut:true,deleteAfter}));await submission});
  assert.equal(fixture.signals,1);assert.equal(fixture.redirect,'/');assert.equal(storage.get('account-deletion-notice'),new Date(deleteAfter).toISOString());
  await act(async()=>{renderer.update(React.createElement(Controls,{...props,isOwner:true}))});
  assert.equal(button('注销我的账号'),undefined);assert.equal(button('放弃管理员权限'),undefined);assert.match(text(renderer.toJSON()),/所有权交接/);
  await act(async()=>{renderer.update(React.createElement(Controls,{...props,isOwner:false,role:'member'}))});
  assert.ok(button('注销我的账号'));assert.equal(button('放弃管理员权限'),undefined);
  console.log('PASS lifecycle UI: settings placement, visible grace/cleanup terms, unchecked confirmation, current password, own-only payload, busy protection, role refresh, deadline notice/sign-out and protected-owner controls');
} finally {if(renderer)await act(async()=>renderer.unmount());globalThis.fetch=previous.fetch;globalThis.sessionStorage=previous.storage;globalThis.location=previous.location;globalThis.IS_REACT_ACT_ENVIRONMENT=previous.act;delete globalThis.__lifecycleUi;}
