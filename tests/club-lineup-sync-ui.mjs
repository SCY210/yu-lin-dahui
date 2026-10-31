// Real ClubApp state, transport sequencing, form lifecycle and polling; no production calls.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdirSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import React,{act} from 'react';
import {create} from 'react-test-renderer';
mkdirSync('.test-output',{recursive:true});
const fixture=globalThis.__clubLineupUi={route:{page:'events',eventId:'event',tab:'rounds'},navigation:{rankingSelection:null,navigate(){},reset(){}},ctx:null,reads:[],posts:[],toasts:[],postStatus:200,queuedReads:[]};
const themeHooks=(readFileSync('app/club-app.tsx','utf8').match(/import\s*\{([^}]+)\}\s*from\s*['"]\.\/visual-theme['"]/)?.[1]??'useVisualTheme').split(',').map(name=>name.trim()).filter(name=>/^\w+$/.test(name));
await build({entryPoints:['app/club-app.tsx'],outfile:'.test-output/club-lineup-sync-ui.mjs',bundle:true,platform:'node',format:'esm',jsx:'automatic',alias:{'@':resolve('.')},external:['react','react/*','react-dom','react-dom/*','lucide-react'],loader:{'.css':'empty'},plugins:[{name:'club-sync-ui',setup(b){
 b.onResolve({filter:/.*/},a=>{
  if(a.path==='sonner')return {path:'toast',namespace:'club-sync'};
  if(a.path==='next/image')return {path:'image',namespace:'club-sync'};
  if(a.path.endsWith('/club-navigation-react'))return {path:'navigation',namespace:'club-sync'};
  if(a.path.endsWith('/session-sync'))return {path:'session',namespace:'club-sync'};
  if(a.path.endsWith('/wake-recovery'))return {path:'transport',namespace:'club-sync'};
  if(a.importer.replaceAll('\\','/').endsWith('/app/club-app.tsx')&&a.path.startsWith('./')&&!a.path.endsWith('.css')&&a.path!=='./form-fields')return {path:a.path,namespace:'club-sync'};
 });
 b.onLoad({filter:/.*/,namespace:'club-sync'},a=>{
  const content=a.path==='./visual-theme'?themeHooks.map(name=>`export const ${name}=()=>${/^use/.test(name)?'false':'null'};`).join('\n')
   :a.path==='toast'?`export const Toaster=()=>null;export const toast=Object.fromEntries(['info','success','error'].map(kind=>[kind,message=>globalThis.__clubLineupUi.toasts.push({kind,message})]));`
   :a.path==='navigation'?`import{createContext}from'react';export const ClubNavigationContext=createContext(null);export const useClubNavigation=()=>({route:globalThis.__clubLineupUi.route,navigation:globalThis.__clubLineupUi.navigation});`
   :a.path==='session'?`export const listenForSessionChanges=()=>({stop(){}});export const notifySessionChange=()=>{};`
   :a.path==='transport'?`export const fetchWithWakeRetry=(...args)=>globalThis.__clubLineupUi.fetch(...args);`
   :['./score-reminder','./bonus-popup','./notification-prompt'].includes(a.path)?`export default function Capture(props){globalThis.__clubLineupUi[${JSON.stringify(a.path)}]=props;return null}`
   :a.path==='./event-view'?`import{createElement as h}from'react';export default function View({ctx}){globalThis.__clubLineupUi.ctx=ctx;const m=ctx.data.matches[0];return h('section',{},h('pre',{'data-lineup':true},JSON.stringify({revision:ctx.data.revision,a:m.a,b:m.b})),h('button',{id:'open-lineup',onClick:()=>ctx.open('调整上场人员','liveLineup',{matchId:m.id,expectedA:[...m.a],expectedB:[...m.b],a:[...m.b],b:[...m.a]},[])},'调整阵容'));}`
   :a.path==='./forms-dialog'?`import{createElement as h}from'react';export default function Forms({form,action}){return form?h('section',{'data-editor':true},h('pre',{},JSON.stringify(form.values)),h('button',{id:'save-lineup',onClick:()=>void action(form.action,form.values).catch(()=>{})},'保存阵容')):null;}`
   :`export default function Shell({children}){return children??null}export const TreasureIcon=()=>null,AccountNoticeEvidence=()=>null,MyAchievements=()=>null,MySettings=()=>null,SimulationEntry=()=>null,Avatar=()=>null,HomeBounties=()=>null,PastTournaments=()=>null,useVisualTheme=()=>false,newEventForm=()=>({});`;
  return {loader:'js',contents:content};
 });
}}]});
const App=(await import(pathToFileURL(resolve('.test-output/club-lineup-sync-ui.mjs')).href)).default;
const prior=Object.fromEntries(['window','document','navigator','IS_REACT_ACT_ENVIRONMENT','setTimeout','clearTimeout'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
const timers=new Map(),delays=[],listeners=new Map();let sequence=0,ui;
const state=(revision,a=['p0','p1'],b=['p2','p3'])=>({revision,period:'2026-10',rankingYear:2026,settings:{name:'Fixture',rules:{}},accountNotice:{required:false,receipts:[]},me:{id:'admin-b',playerId:'p0',role:'admin'},players:[],events:[{id:'event',status:'open',livePlay:{enabled:true},title:'Fixture',start:Date.now()-3600000,end:Date.now()+3600000}],rounds:[{id:'round',eventId:'event',status:'playing'}],matches:[{id:'match',eventId:'event',roundId:'round',a,b,status:'playing',start:1,games:[],scoreA:null,scoreB:null}],bookings:[],registrations:[],attendance:[],costs:[],seasons:[],quarterlyLeaderboard:[],annualLeaderboard:[],challenges:[],tagVotes:[],awardVotes:[],photos:[],settlements:[],audits:[],accounts:[],drafts:[],deletedEvents:[],leaderboard:[],social:{stats:[],funny:[],personality:[],annual:[],arenas:{},courtBoards:{},matchLevels:{}},rotationPlans:{},achievements:{}});
fixture.server=state(10);
const response=value=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json',ETag:'"r'+value.revision+'"'}});
fixture.fetch=async(url,options={})=>{
 if(options.method==='POST'){
  const body=JSON.parse(options.body);fixture.posts.push(body);
  if(fixture.postStatus===409)return new Response(JSON.stringify({error:'上场人员已更新，请重新选择'}),{status:409});
  fixture.server=state(fixture.server.revision+1,body.payload.a,body.payload.b);
  return response({ok:true,revision:fixture.server.revision});
 }
 fixture.reads.push({url,headers:options.headers});
 const next=fixture.queuedReads.shift();return next instanceof Promise?await next:response(next??fixture.server);
};
Object.defineProperty(globalThis,'window',{configurable:true,value:{addEventListener(){},removeEventListener(){}}});
Object.defineProperty(globalThis,'document',{configurable:true,value:{hidden:false,addEventListener:(key,f)=>listeners.set(key,f),removeEventListener:key=>listeners.delete(key)}});
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:true}});
Object.defineProperty(globalThis,'IS_REACT_ACT_ENVIRONMENT',{configurable:true,value:true});
globalThis.setTimeout=(fn,ms,...args)=>{if(ms===3000||ms===15000){const id=++sequence;timers.set(id,fn);delays.push(ms);return id}return prior.setTimeout.value(fn,ms,...args)};
globalThis.clearTimeout=id=>{if(timers.has(id))timers.delete(id);else prior.clearTimeout.value(id)};
const pause=()=>new Promise(resolve=>prior.setTimeout.value(resolve,0));
const settle=async()=>{await pause();await pause();await pause()};
const displayed=()=>JSON.parse(ui.root.findByProps({'data-lineup':true}).children[0]);
const editors=()=>ui.root.findAllByProps({'data-editor':true});
const click=async id=>act(async()=>{ui.root.findByProps({id}).props.onClick();await settle()});
const refresh=async()=>act(async()=>{await fixture.ctx.refresh();await settle()});
try{
 await act(async()=>{ui=create(React.createElement(App));await settle()});assert.equal(displayed().revision,10);assert.ok(delays.includes(3000),'planned/round match pages use collaboration polling');
 await click('open-lineup');assert.equal(editors().length,1);
 fixture.server=state(11,['p4','p1']);await refresh();assert.equal(displayed().revision,11);assert.equal(editors().length,0,'another admin updating teams closes the stale live editor');assert.ok(fixture.toasts.some(t=>t.kind==='info'&&t.message.includes('已同步最新阵容')));
 await click('open-lineup');fixture.server=state(12,['p5','p1']);fixture.postStatus=409;await click('save-lineup');assert.equal(displayed().revision,12);assert.equal(editors().length,0,'a conflicting write refreshes and closes the submitted stale editor');assert.ok(fixture.toasts.some(t=>t.kind==='error'&&t.message.includes('上场人员已更新')));
 fixture.queuedReads.push(state(11));await refresh();assert.equal(displayed().revision,12,'a later-arriving stale server read cannot rewind the view');
 await refresh();fixture.postStatus=200;await click('open-lineup');fixture.queuedReads.push(state(12,['p5','p1']));const infoCount=fixture.toasts.filter(t=>t.kind==='info').length;await click('save-lineup');assert.equal(fixture.server.revision,13);assert.equal(editors().length,0);assert.equal(fixture.toasts.filter(t=>t.kind==='info').length,infoCount,'own writes never announce another administrator');
 assert.equal(fixture.reads.at(-1).headers?.['If-None-Match'],undefined,'the post-write refresh does not reuse an older validator');await refresh();assert.deepEqual(displayed(),{revision:13,a:fixture.server.matches[0].a,b:fixture.server.matches[0].b});
 let complete;fixture.queuedReads.push(new Promise(resolve=>{complete=resolve}));let oldRead;await act(async()=>{oldRead=fixture.ctx.refresh();await pause()});fixture.server=state(14,['p6','p1']);await refresh();await act(async()=>{complete(response(state(13)));await oldRead;await settle()});assert.equal(displayed().revision,14,'an in-flight old read cannot undo a fresh lineup');
 const notificationBefore=fixture['./notification-prompt'].blocked;fixture.server=state(15);fixture.server.me.bonusNotices=[{id:'bonus-fixture',kind:'mvp',points:5,at:Date.now(),title:'Fixture'}];await refresh();assert.equal(fixture['./bonus-popup'].notices.length,1);assert.equal(fixture['./bonus-popup'].blocked,false);assert.equal(fixture['./score-reminder'].blocked,true);assert.equal(fixture['./notification-prompt'].blocked,true);await act(async()=>{fixture['./bonus-popup'].onDismiss(['bonus-fixture']);await settle()});assert.equal(fixture['./bonus-popup'].notices.length,0);assert.equal(fixture['./score-reminder'].blocked,false);assert.equal(fixture['./notification-prompt'].blocked,notificationBefore);
 // Scoped responses are replacements, never a history cache used to paint an unrelated route.
 fixture.server={...state(16),activityScope:'event'};await refresh();assert.equal(fixture.ctx.data.activityScope,'event');
 assert.match(fixture.reads.at(-1).url,/activity=event/);
 const oldRefresh=fixture.ctx.refresh;let finishA,lateA;
 fixture.queuedReads.push(new Promise(resolve=>{finishA=resolve}));
 await act(async()=>{lateA=oldRefresh();await pause()});
 const next=state(17);next.activityScope='second';next.events[0].id='second';next.rounds[0].eventId='second';next.matches[0].eventId='second';fixture.server=next;
 fixture.route={page:'events',eventId:'second',tab:'rounds'};
 await act(async()=>{ui.update(React.createElement(App));await settle()});
 assert.equal(fixture.ctx.data.activityScope,'second');assert.equal(displayed().revision,17);
 assert.match(fixture.reads.at(-1).url,/activity=second/);assert.equal(fixture.reads.find(r=>r.url.includes('activity=second')).headers?.['If-None-Match'],undefined);
 const readsBefore=fixture.reads.length;await act(async()=>{await oldRefresh();finishA(response({...state(16),activityScope:'event'}));await lateA;await settle()});
 assert.equal(fixture.reads.length,readsBefore,'a write callback from the previous activity cannot start another old-scope read');
 assert.equal(displayed().revision,17,'an old activity response cannot replace the current activity');
 let finishFull;fixture.queuedReads.push(new Promise(resolve=>{finishFull=resolve}));fixture.route={page:'home'};
 await act(async()=>{ui.update(React.createElement(App));await pause()});
 assert.equal(ui.root.findAllByProps({'data-lineup':true}).length,0,'scoped content is hidden while loading the full home view');
 assert.ok(!fixture.reads.at(-1).url.includes('activity='));assert.equal(fixture.reads.at(-1).headers?.['If-None-Match'],undefined);
 await act(async()=>{finishFull(response(state(18)));await settle()});
 assert.equal(ui.root.findAllByProps({'data-lineup':true}).length,0);
 console.log('PASS club lineup UI: remote-admin editor invalidation, write races, scope switch gates, full-view recovery, stale closure/response rejection and fast polling');
}finally{if(ui)await act(()=>ui.unmount());for(const [key,value]of Object.entries(prior)){if(value)Object.defineProperty(globalThis,key,value);else delete globalThis[key]}delete globalThis.__clubLineupUi}
