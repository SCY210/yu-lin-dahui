import {test} from 'node:test';
import assert from 'node:assert/strict';
import {arrivalCommand,arrivalHolds,myArrivalHolds} from '../lib/client/arrival-holds';
import type {Event} from '../lib/domain/types';

const now=Date.parse('2026-10-25T17:00:00Z'),hour=3600000;
const event=(id:string,extra:Partial<Event>={}):Event=>({id,creatorId:'owner',title:'虚构活动 '+id,start:now-hour,end:now+hour,venue:'虚构球馆',address:'',capacity:8,signupDeadline:now-2*hour,cancelDeadline:now-2*hour,note:'',status:'open',courtMode:'equal',ballMode:'equal',
 pointsSession:{attendance:[{playerId:'friend',late:true,available:false,at:now-20},{playerId:'me',late:true,available:false,at:now-10},{playerId:'back',late:true,available:true,at:now-30}],waiting:[]},noShowHold:['me','gone'],...extra});
const players=[{id:'me',ownerId:'alice'},{id:'friend',ownerId:'alice'},{id:'back',ownerId:'bob'},{id:'gone',ownerId:'carol'}];

test('迟到且还没到场的、被标记没到场的球友，在活动进行中都要确认到场',()=>{
 assert.deepEqual(arrivalHolds(event('a'),now).map(h=>[h.playerId,h.kind]),[['friend','late'],['me','late'],['gone','noShow']],
  'oldest report first; someone already back is not held; a late hold is not listed twice');
 for(const extra of [{status:'ended'},{status:'cancelled'},{deletedAt:now},{tournament:{} as Event['tournament']},{matchFormat:'practice'},{start:now+1},{end:now}] as Partial<Event>[])
  assert.deepEqual(arrivalHolds(event('a',extra),now),[],JSON.stringify(extra));
});

test('首页只显示自己和自己代报名朋友的到场确认，并发出对应的恢复命令',()=>{
 const holds=myArrivalHolds([event('a'),event('b',{noShowHold:[],pointsSession:{attendance:[],waiting:[]}})],players,{id:'alice',playerId:'me'},now);
 assert.deepEqual(holds.map(h=>[h.eventId,h.playerId,h.kind]),[['a','friend','late'],['a','me','late']]);
 assert.deepEqual(arrivalCommand(holds[1]),{action:'pointsPresence',payload:{eventId:'a',playerId:'me',status:'arrived'}});
 assert.deepEqual(arrivalCommand({eventId:'a',playerId:'gone',kind:'noShow'}),{action:'noShowArrived',payload:{eventId:'a',playerId:'gone'}});
 assert.deepEqual(myArrivalHolds([event('a')],players,{id:'dave',playerId:'dave'},now),[],'other members see nothing on their home page');
});
