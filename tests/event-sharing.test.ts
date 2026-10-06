import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createEventShare,eventShareTargets,shareEvent} from '../lib/client/event-sharing';
import {ClubNavigation,readClubRoute,type NavigationPort} from '../lib/client/club-navigation';
import type {Event} from '../lib/domain/types';

const event:Event={id:'event /你好?&',title:'周末羽毛球 & 双打',start:Date.parse('2026-10-06T16:00:00Z'),end:Date.parse('2026-10-06T18:00:00Z'),venue:'球馆 & 朋友',address:'private address',note:'private note',status:'open',capacity:8,signupDeadline:0,cancelDeadline:0,courtMode:'equal',ballMode:'equal',creatorId:'private account'};
const data=()=>createEventShare(event,'羽林大会','https://club.example/?token=private#private')!;

test('share link encodes the event ID and opens its signup tab with no unrelated parameters',()=>{
 const shared=data(),url=new URL(shared.url),route=readClubRoute(shared.url);
 assert.equal(url.origin,'https://club.example');assert.equal(url.pathname,'/');assert.equal(url.hash,'');
 assert.deepEqual([...url.searchParams.keys()],['page','event','tab']);
 assert.equal(route.page,'events');assert.equal(route.eventId,event.id);assert.equal(route.tab,'signup');
});

test('a newly authenticated member retains the direct event URL',()=>{
 let href=data().url,state:unknown=null;
 const port:NavigationPort={href:()=>href,state:()=>state,push:()=>{assert.fail('login must not push another history entry')},replace:(next,url)=>{state=next;href=new URL(url,href).href},go:()=>{},scrollY:()=>0,scrollTo:()=>{}};
 const navigation=new ClubNavigation(port,'new-member','new-session');
 assert.equal(navigation.route.eventId,event.id);assert.equal(navigation.route.tab,'signup');
});

test('invitation contains only event summary fields and Madrid-local dates',()=>{
 const shared=data();
 assert.equal(shared.title,`羽林大会 · ${event.title}`);
 for(const text of [event.title,event.venue,'2026年10月6日','18:00','20:00','报名中','需登录成员账号'])assert.ok(shared.text.includes(text),text);
 for(const text of [event.address,event.note,event.creatorId!,'正式名单','候补名单'])assert.ok(!shared.text.includes(text),text);
 assert.deepEqual(Object.keys(shared),['title','text','url']);
});

test('full end date survives overnight events and winter uses Madrid UTC+1',()=>{
 const shared=createEventShare({...event,start:Date.parse('2026-12-31T22:30:00Z'),end:Date.parse('2027-01-01T00:30:00Z')},'Club','https://club.example')!;
 for(const text of ['2026年12月31日','2027年1月1日','23:30','01:30'])assert.ok(shared.text.includes(text),text);
});

test('drafts, deleted events and merged-away events cannot generate invitations',()=>{
 for(const patch of [{status:'draft' as const},{deletedAt:0},{deletedAt:123},{mergedInto:'other'}])assert.equal(createEventShare({...event,...patch},'Club','https://club.example'),null);
 assert.ok(createEventShare({...event,status:'cancelled'},'Club','https://club.example')!.text.includes('已取消'));
 assert.ok(createEventShare({...event,status:'ended'},'Club','https://club.example')!.text.includes('已结束'));
});

test('native share is invoked immediately with the correct receiver and invitation',async()=>{
 const shared=data();let called=false;
 const port={canShare(value:unknown){assert.equal(this,port);assert.deepEqual(value,shared);return true},async share(value:unknown){assert.equal(this,port);assert.deepEqual(value,shared);called=true}};
 const result=shareEvent(shared,port);
 assert.equal(called,true,'no await may precede the native share call');
 assert.equal(await result,'shared');
});

test('unsupported or policy-blocked native share falls back without copying or sending',async()=>{
 assert.equal(await shareEvent(data(),{}),'fallback');
 assert.equal(await shareEvent(data(),{canShare:()=>false,share:async()=>{assert.fail('unsupported payload')}}),'fallback');
 for(const name of ['NotAllowedError','DataError','InvalidStateError','TypeError'])assert.equal(await shareEvent(data(),{share:async()=>{throw {name}}}),'fallback');
 assert.equal(await shareEvent(data(),{canShare:()=>{throw new Error('blocked')},share:async()=>{assert.fail('blocked')}}),'fallback');
});

test('cancelling the native sheet is silent and does not trigger fallback',async()=>{
 assert.equal(await shareEvent(data(),{share:async()=>{throw {name:'AbortError'}}}),'cancelled');
});

test('composer links preserve Unicode, ampersands and exactly one direct event link',()=>{
 const shared=data(),targets=eventShareTargets(shared),message=`${shared.text}\n${shared.url}`;
 const whatsapp=new URL(targets.whatsapp);assert.equal(whatsapp.origin,'https://wa.me');assert.equal(whatsapp.searchParams.get('text'),message);
 const telegram=new URL(targets.telegram);assert.equal(telegram.origin,'https://t.me');assert.equal(telegram.pathname,'/share/url');assert.equal(telegram.searchParams.get('url'),shared.url);assert.equal(telegram.searchParams.get('text'),shared.text);
 const email=new URL(targets.email);assert.equal(email.protocol,'mailto:');assert.equal(email.searchParams.get('subject'),shared.title);assert.equal(email.searchParams.get('body'),message);
});
