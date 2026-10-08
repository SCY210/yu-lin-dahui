import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {allowedPushEndpoint,newlyOpenedSignups,signupPushMessage} from '../lib/push-contract';
import {emptyState,type Event} from '../lib/domain/types';

const now=Date.parse('2026-10-06T12:00:00Z');
const event=(status:Event['status']='open'):Event=>({id:'fixture-event',title:'虚构新接龙',creatorId:'creator',start:now+3600000,end:now+7200000,venue:'模拟球馆',address:'',capacity:8,signupDeadline:now+3600000,cancelDeadline:now,note:'',status,courtMode:'equal',ballMode:'equal'});
test('only a new open activity or first publication of a draft creates a signup alert',()=>{
 const before=emptyState(),after=emptyState();after.events=[event()];assert.equal(newlyOpenedSignups(after,before,now).length,1);
 before.events=[event('draft')];assert.equal(newlyOpenedSignups(after,before,now).length,1);
 for(const status of ['open','locked','live','ended','cancelled'] as const){before.events=[event(status)];assert.equal(newlyOpenedSignups(after,before,now).length,0)}
 before.events=[];for(const status of ['draft','locked','live','ended','cancelled'] as const){after.events=[event(status)];assert.equal(newlyOpenedSignups(after,before,now).length,0)}
 after.events=[{...event(),deletedAt:now}];assert.equal(newlyOpenedSignups(after,before,now).length,0);after.events=[{...event(),end:now}];assert.equal(newlyOpenedSignups(after,before,now).length,0);
 before.events=[{...event('draft'),deletedAt:now}];after.events=[event()];assert.equal(newlyOpenedSignups(after,before,now).length,0);
});
test('push endpoints accept browser providers and reject arbitrary origins, credentials, local addresses and redirects',()=>{
 for(const endpoint of ['https://fcm.googleapis.com/fcm/send/fixture','https://updates.push.services.mozilla.com/wpush/v2/fixture','https://web.push.apple.com/fixture','https://a.notify.windows.com/fixture'])assert.equal(allowedPushEndpoint(endpoint),true);
 for(const endpoint of ['http://fcm.googleapis.com/fixture','https://127.0.0.1/x','https://localhost/x','https://example.com/x','https://fcm.googleapis.com.evil.example/x','https://name:secret@fcm.googleapis.com/x','https://fcm.googleapis.com:8443/x','https://fcm.googleapis.com/x#fragment','https://fcm.googleapis.com/x?redirect=1'])assert.equal(allowedPushEndpoint(endpoint),false);
});
test('signup messages contain a bounded title, Madrid time and event ID, not member or accounting information',()=>{
 const message=signupPushMessage({...event(),title:'球'.repeat(1000),venue:'馆'.repeat(1000)});assert.ok(message.body.length<200);assert.equal(message.eventId,'fixture-event');assert.equal(message.kind,'signup');assert.equal(message.tag,'yulin-signup-fixture-event');assert.match(signupPushMessage(event()).body,/15:00/);
});
function worker(){
 const handlers=new Map<string,(event:unknown)=>void>(),notifications:{title:string;options:Record<string,unknown>}[]=[],opened:string[]=[],navigated:string[]=[];
 const self={location:{origin:'https://club.example'},addEventListener:(name:string,handler:(event:unknown)=>void)=>handlers.set(name,handler),registration:{showNotification:async(title:string,options:Record<string,unknown>)=>notifications.push({title,options})},clients:{matchAll:async()=>[{url:'https://elsewhere.example/',navigate:async()=>{}},{url:'https://club.example/',navigate:async(url:string)=>navigated.push(url),focus:async()=>{}}],openWindow:async(url:string)=>opened.push(url)}};
 runInNewContext(readFileSync('public/sw.js','utf8'),{self,URL,encodeURIComponent});
 async function dispatch(name:string,data:object){let pending:Promise<unknown>|undefined;handlers.get(name)!({...data,waitUntil:(promise:Promise<unknown>)=>{pending=promise}});await pending}
 return {notifications,opened,navigated,dispatch};
}
test('a push displays a system notification with a stable tag and a safe activity destination',async()=>{
 const sw=worker();await sw.dispatch('push',{data:{json:()=>({...signupPushMessage(event()),body:'新活动',path:'https://evil.example/'})}});
 assert.equal(sw.notifications[0].title,'羽林大会 · 新接龙');assert.equal(sw.notifications[0].options.tag,'yulin-signup-fixture-event');assert.equal(sw.notifications[0].options.renotify,false);
 assert.equal((sw.notifications[0].options.data as {path:string}).path,'/?page=events&event=fixture-event');
});
test('missing, malformed or null payloads still create a visible fallback notification',async()=>{
 for(const value of [null,'wrong',[],undefined]){const sw=worker();await sw.dispatch('push',{data:{json:()=>value}});assert.equal(sw.notifications.length,1);assert.equal((sw.notifications[0].options.data as {path:string}).path,'/?page=me')}
 const sw=worker();await sw.dispatch('push',{data:{json:()=>{throw Error('invalid')}}});assert.equal(sw.notifications.length,1);
});
test('notification clicks reuse a same-origin window and cannot navigate to external destinations',async()=>{
 const sw=worker();let closed=false;await sw.dispatch('notificationclick',{notification:{close:()=>{closed=true},data:{path:'/?page=events&event=fixture-event'}}});assert.equal(closed,true);assert.deepEqual(sw.navigated,['https://club.example/?page=events&event=fixture-event']);assert.equal(sw.opened.length,0);
 await sw.dispatch('notificationclick',{notification:{close:()=>{},data:{path:'https://evil.example/'}}});assert.equal(sw.navigated[1],'https://club.example/?page=me');
});
