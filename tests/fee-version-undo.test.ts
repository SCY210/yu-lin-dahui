import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apply} from '../lib/domain/commands';
import {markIgnoredUpdate,settlementFingerprint,settlementView} from '../lib/domain/settlement-state';
import {canManageEvent} from '../lib/domain/permissions';
import {emptyState,type Account,type Settlement,type State} from '../lib/domain/types';

const now=Date.parse('2026-11-04T20:00:00Z'),hour=3600000;
const owner:Account={id:'owner',email:'',role:'admin',playerId:'p0'};
const alice:Account={id:'alice',email:'',role:'member',playerId:'p1'};
const version=(id:string,n:number,cents:number):Settlement=>({id,eventId:'e',version:n,created:now-(3-n)*hour,reason:'确认',confirmed:true,total:cents*2,subsidy:0,unallocated:0,bills:['p0','p1'].map(playerId=>({playerId,court:cents,ball:0,other:0,total:cents,minutes:120})),detail:[]});
function fixture():State{
 const s=emptyState();s.settings.initialized=true;s.settings.ownerAccountId=owner.id;s.accounts=[owner,alice].map(a=>({...a}));
 s.players=s.accounts.map(a=>({id:a.playerId,name:a.id,ownerId:a.id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''}));
 s.events.push({id:'e',creatorId:owner.id,title:'周四双打',start:now-4*hour,end:now-2*hour,venue:'球馆',address:'',capacity:8,signupDeadline:now-5*hour,cancelDeadline:now-5*hour,note:'',status:'ended',courtMode:'equal',ballMode:'equal'});
 s.settlements.push(version('v1',1,600),version('v2',2,700));
 s.payments.push({id:'pay',eventId:'e',playerId:'p1',cents:600,at:now-hour} as State['payments'][number]);
 return s;
}
const current=(s:State)=>settlementView(undefined,s.settlements.filter(x=>x.eventId==='e'),false).latest;

test('撤回刚确认的版本：上一版重新生效，被撤回的版本留在记录里，付款标记不变',async()=>{
 const s=fixture(),payments=structuredClone(s.payments);
 await apply(s,owner,'settleRevoke',{eventId:'e',settlementId:'v2',reason:'金额算错'},now);
 assert.equal(current(s)!.id,'v1');
 const v2=s.settlements.find(x=>x.id==='v2')!;assert.equal(v2.confirmed,false);assert.equal(v2.revokedAt,now);assert.equal(v2.revokedBy,'owner');
 assert.deepEqual(s.payments,payments);
 // Withdrawing the only remaining version leaves the activity unconfirmed.
 await apply(s,owner,'settleRevoke',{eventId:'e',settlementId:'v1',reason:''},now);
 assert.equal(current(s),undefined);assert.equal(s.settlements.length,2,'no version is deleted');
});

test('撤回只能针对当前最新的确认版本，只有活动管理者可以操作',async()=>{
 const s=fixture(),before=structuredClone(s);
 await assert.rejects(()=>apply(s,owner,'settleRevoke',{eventId:'e',settlementId:'v1',reason:''},now),/409/);
 await assert.rejects(()=>apply(s,alice,'settleRevoke',{eventId:'e',settlementId:'v2',reason:''},now),/403|权限/);
 await assert.rejects(()=>apply(s,alice,'feeUpdateIgnore',{eventId:'e',settlementId:'v2',fingerprint:'0123456789abcdef',reason:''},now),/403|权限/);
 assert.deepEqual(s,before);
});

test('忽略这次更新：只对这一次的预览有效，费用再变化或重新确认后会重新提示',async()=>{
 const s=fixture(),draft={...version('draft',3,750),confirmed:false};
 const view=()=>settlementView(markIgnoredUpdate(draft,s.events[0],s.settlements),s.settlements.filter(x=>x.eventId==='e'),true);
 assert.equal(view().changed,true);assert.equal(view().shown!.total,1500);
 await apply(s,owner,'feeUpdateIgnore',{eventId:'e',settlementId:'v2',fingerprint:settlementFingerprint(draft),reason:'忽略'},now);
 assert.equal(view().changed,false);assert.equal(view().confirmed,true);assert.equal(view().shown,s.settlements.find(x=>x.id==='v2'),'the confirmed version is shown');
 // Another change to the preview brings the update back.
 draft.bills[0]={...draft.bills[0],court:760,total:760};assert.equal(view().changed,true);
 // The update can be shown again on purpose, and confirming or withdrawing a version clears the choice.
 await apply(s,owner,'feeUpdateIgnore',{eventId:'e',settlementId:'v2',fingerprint:settlementFingerprint(draft),reason:''},now);assert.equal(view().changed,false);
 await apply(s,owner,'feeUpdateIgnore',{eventId:'e',settlementId:'v2',fingerprint:null,reason:''},now);assert.equal(s.events[0].feeUpdateIgnored,undefined);assert.equal(view().changed,true);
 await apply(s,owner,'feeUpdateIgnore',{eventId:'e',settlementId:'v2',fingerprint:settlementFingerprint(draft),reason:''},now);
 await apply(s,owner,'settleRevoke',{eventId:'e',settlementId:'v2',reason:''},now);assert.equal(s.events[0].feeUpdateIgnored,undefined);
 await assert.rejects(()=>apply(s,owner,'feeUpdateIgnore',{eventId:'e',settlementId:'v2',fingerprint:settlementFingerprint(draft),reason:''},now),/409/,'only the current confirmed version');
});

test('宗主和长老都能撤回和忽略，不必是活动创建者',async()=>{
 for(const who of ['admin','owner'] as const){
  const s=fixture(),actor:Account={id:'carol',email:'',role:who==='admin'?'admin':'member',playerId:'p2'};
  s.accounts.push(actor);s.players.push({id:'p2',name:'carol',ownerId:'carol',initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''});
  if(who==='owner')s.settings.ownerAccountId='carol';
  assert.ok(canManageEvent({...actor,isOwner:who==='owner'},s.events[0]),who+' sees the fee controls');
  await apply(s,actor,'feeUpdateIgnore',{eventId:'e',settlementId:'v2',fingerprint:'0123456789abcdef',reason:''},now);
  await apply(s,actor,'settleRevoke',{eventId:'e',settlementId:'v2',reason:''},now);
  assert.equal(current(s)!.id,'v1',who);
 }
 assert.equal(canManageEvent(alice,{creatorId:'owner'}),false,'an ordinary member does not');
});
