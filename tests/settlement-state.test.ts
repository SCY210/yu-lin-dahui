import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apply} from '../lib/domain/commands';
import {calculateSettlement} from '../lib/domain/money';
import {sameSettlement,settlementView} from '../lib/domain/settlement-state';
import {emptyState,type Event} from '../lib/domain/types';

const start=Date.parse('2026-10-08T17:00:00Z'),end=start+7200000;
function fixture(){
 const s=emptyState(),a={id:'owner',playerId:'p0',role:'admin' as const,email:''};s.settings.initialized=true;s.settings.ownerAccountId=a.id;s.accounts.push(a);
 const e:Event={id:'event',title:'Fictional Thursday',creatorId:a.id,start,end,venue:'Fictional',address:'',capacity:6,signupDeadline:end,cancelDeadline:start-86400000,note:'',status:'open',attendanceMode:'automatic',courtMode:'interval',ballMode:'interval'};s.events.push(e);
 s.bookings.push({id:'court',eventId:e.id,name:'Court',start,end,pricing:'hourly',cents:690});
 for(let i=0;i<6;i++){const id='p'+i;s.players.push({id,name:id,ownerId:i?'other':a.id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''});s.registrations.push({id:'r'+i,eventId:e.id,playerId:id,sequence:i+1,status:'confirmed',arrival:start,departure:end,registeredAt:start-60000,note:'',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''},bookingSignups:[{bookingId:'court',status:'confirmed',sequence:i+1,arrival:start,departure:end,registeredAt:start-60000,joinedAsWaitlist:false,cancelRequested:false,note:''}]})}
 s.costs.push({id:'balls',eventId:e.id,type:'ball',name:'Shuttles',pricing:'unit',cents:80,tubeCount:8,used:8,start:null,end:null,bearer:'members'});
 const confirm=(reason='Confirm split')=>apply(s,a,'settle',{eventId:e.id,confirmed:true,reason},end+60000);return {s,e,a,confirm};
}
test('a confirmed six-person EUR20.20 split displays the saved version rather than preview',async()=>{
 const {s,e,confirm}=fixture();let view=settlementView(calculateSettlement(s,e,end),s.settlements,true);assert.equal(view.confirmed,false);assert.equal(view.latest,undefined);
 await confirm();const saved=structuredClone(s.settlements[0]);assert.equal(saved.total,2022);assert.equal(saved.expenseTotal,2020);assert.equal(saved.roundingDifference,2);assert.equal(saved.bills.reduce((n,b)=>n+b.total,0),2022);assert.deepEqual(saved.bills.map(b=>b.total),[337,337,337,337,337,337]);
 view=settlementView(calculateSettlement(s,e,end+60000),s.settlements,true);assert.equal(view.confirmed,true);assert.equal(view.changed,false);assert.equal(view.latest!.version,1);assert.deepEqual(view.shown,saved);
});
test('identical confirmation preserves the original version, timestamp and audit despite a new reason',async()=>{
 const {s,confirm}=fixture();await confirm();const before=structuredClone(s);await confirm('Clicked again');assert.deepEqual(s,before);
});
test('a financial edit becomes a pending preview for the host; members keep the previous confirmed amounts',async()=>{
 const {s,e,confirm}=fixture();await confirm();const first=structuredClone(s.settlements[0]);s.costs[0].used=10;const draft=calculateSettlement(s,e,end+60000),host=settlementView(draft,s.settlements,true),member=settlementView(draft,s.settlements,false);
 assert.equal(host.changed,true);assert.equal(host.confirmed,false);assert.equal(host.shown!.total,2184);assert.equal(member.shown!.total,2022);await confirm('Revised shuttles');assert.equal(s.settlements.length,2);assert.deepEqual(s.settlements[0],first);assert.equal(s.settlements[1].version,2);assert.equal(settlementView(draft,s.settlements,true).confirmed,true);
});
test('snapshot ordering and metadata do not imply a change, while timing/shares/event changes do',async()=>{
 const {s,e,confirm}=fixture();await confirm();const original=s.settlements[0],reordered=structuredClone(original);reordered.bills.reverse();reordered.detail.reverse();for(const d of reordered.detail)d.shares=Object.fromEntries(Object.entries(d.shares).reverse());reordered.version=12;reordered.reason='metadata';assert.ok(sameSettlement(original,reordered));
 for(const alter of [(v:typeof reordered)=>{v.bills[0].minutes--},(v:typeof reordered)=>{v.detail[0].name+=' revised'},(v:typeof reordered)=>{v.eventId='foreign'}]){const next=structuredClone(original);alter(next);assert.equal(sameSettlement(original,next),false)}
 assert.equal(settlementView(calculateSettlement(s,e,end),[reordered,original],true).latest!.version,12);
});
test('a saved draft never marks the result confirmed; early and unallocated confirmations remain rejected',async()=>{
 const {s,e,a,confirm}=fixture();await apply(s,a,'settle',{eventId:e.id,confirmed:false,reason:'Draft'},end);assert.equal(settlementView(calculateSettlement(s,e,end),s.settlements,true).confirmed,false);
 await assert.rejects(()=>apply(s,a,'settle',{eventId:e.id,confirmed:true,reason:'Too early'},end-1),/活动结束/);s.registrations=[];await assert.rejects(confirm,/待分配/);assert.equal(s.settlements.length,1);
});

test('different attendance keeps the original allocation while equivalent attendance shares all components equally',()=>{
 const {s,e}=fixture();s.registrations[5].arrival=start+3600000;s.registrations[5].bookingSignups![0].arrival=start+3600000;const result=calculateSettlement(s,e,end);const full=result.bills.filter(b=>b.playerId!=='p5'),short=result.bills.find(b=>b.playerId==='p5')!;assert.equal(new Set(full.map(b=>b.total)).size,1);assert.ok(short.total<full[0].total);assert.equal(new Set(full.map(b=>b.ball)).size,1);assert.equal(result.bills.reduce((n,b)=>n+b.total,0)+result.subsidy+result.unallocated,result.total);assert.equal(result.expenseTotal!+result.roundingDifference!,result.total);
 for(const b of result.bills)assert.equal(result.detail.reduce((n,d)=>n+(d.shares[b.playerId]??0),0),b.total);
});

test('recipient information can be edited by the host, but foreign members and invalid phone text are rejected',async()=>{
 const {s,e,a}=fixture();e.creatorId='host';const host={id:'host',playerId:'p1',role:'member' as const,email:''};await apply(s,host,'feeRecipient',{eventId:e.id,name:' Fictional host ',phone:'+34 610 000 000',reason:'Set transfer info'},end);assert.deepEqual(s.events[0].feeRecipient,{name:'Fictional host',phone:'+34 610 000 000'});const before=structuredClone(s);await assert.rejects(()=>apply(s,{...host,id:'outsider'},'feeRecipient',{eventId:e.id,name:'x',phone:'610000000',reason:'Spoof'},end),/403/);assert.deepEqual(s,before);await assert.rejects(()=>apply(s,a,'feeRecipient',{eventId:e.id,name:'Host',phone:'javascript:alert(1)',reason:'Invalid'},end));assert.deepEqual(s,before);
});
