import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apply} from '../lib/domain/commands';
import {collectorRepayment,playerSettled,planTransfers,openTransfers} from '../lib/domain/fee-transfers';
import {unpaidBills} from '../lib/domain/fee-payments';
import {calculateSettlement} from '../lib/domain/money';
import {sameSettlement} from '../lib/domain/settlement-state';
import {emptyState,type Account,type State} from '../lib/domain/types';

const hour=3600000,start=Date.parse('2026-11-05T18:00:00Z'),end=start+3*hour,after=end+hour;
const owner:Account={id:'owner',email:'',role:'admin',playerId:'p0'};
const alice:Account={id:'alice',email:'',role:'member',playerId:'p1'};
const bob:Account={id:'bob',email:'',role:'member',playerId:'p2'};
const carol:Account={id:'carol',email:'',role:'member',playerId:'p3'};
/** Owner, Alice, Bob, Carol and Alice's friend play all three hours. Alice booked 18–20, Bob 20–21 (12 €/hour), and
 * Carol brought 6 € of balls: every share is 8.40 €. */
async function fixture(){
 const s=emptyState();s.settings.initialized=true;s.settings.ownerAccountId=owner.id;s.accounts=[owner,alice,bob,carol].map(a=>({...a}));
 s.players=[...s.accounts.map(a=>({id:a.playerId,name:a.id,ownerId:a.id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''})),
  {id:'friend',name:'小明',ownerId:'alice',guestEventId:'',initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''}];
 await apply(s,owner,'event',{title:'虚构周四双打',matchFormat:'doubles',start,end,venue:'虚构球馆',address:'',capacity:8,cancelDeadline:start-86400000,note:'',status:'open',
  bookings:[{name:'1号场',start,end:start+2*hour,pricing:'hourly',cents:1200,advancedBy:'p1'},{name:'1号场',start:start+2*hour,end,pricing:'hourly',cents:1200,advancedBy:'p2'}]},start-2*86400000);
 const e=s.events[0];s.players[4].guestEventId=e.id;
 for(const [i,id] of ['p0','p1','p2','p3','friend'].entries())s.registrations.push({id:'r'+i,eventId:e.id,playerId:id,sequence:i,status:'confirmed',arrival:start,departure:end,registeredAt:start-86400000,note:'',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''}});
 await apply(s,owner,'cost',{eventId:e.id,type:'ball',name:'虚构球',pricing:'unit',cents:50,used:12,start:null,end:null,bearer:'members',advancedBy:'p3',reason:'耗球'},after);
 return {s,e};
}
const confirm=(s:State,eventId:string)=>apply(s,owner,'settle',{eventId,confirmed:true,reason:'确认'},after);
const latest=(s:State)=>s.settlements.filter(x=>x.confirmed).at(-1)!;

test('advancers are repaid their advance minus their own share, and the friend owes through Alice',async()=>{
 const {s,e}=await fixture();await confirm(s,e.id);const v=latest(s);
 assert.deepEqual(v.bills.map(b=>[b.playerId,b.total]),[['friend',840],['p0',840],['p1',840],['p2',840],['p3',840]]);
 assert.deepEqual(v.advances,[{playerId:'p1',cents:2400},{playerId:'p2',cents:1200},{playerId:'p3',cents:600}]);
 // Alice is owed 24 − 8.40 − 8.40 (her friend) = 7.20; Bob 12 − 8.40 = 3.60; Carol owes 2.40, the owner 8.40.
 assert.deepEqual(v.transfers,[{from:'p0',to:'p1',cents:720},{from:'p0',to:'p2',cents:120},{from:'p3',to:'p2',cents:240}]);
 assert.ok(!v.transfers!.some(t=>t.from==='friend'||t.from===t.to),'only members transfer, never to themselves');
 for(const id of ['p1','p2'])assert.ok(playerSettled(s.payments,v,id),'an advancer covering their share is shown as paid at once');
 assert.deepEqual(unpaidBills(s,v).map(b=>b.playerId).sort(),['p0','p3']);
});

test('with a member collecting, everyone pays the collector and the collector repays the advancers',async()=>{
 const {s,e}=await fixture();
 await assert.rejects(()=>apply(s,owner,'feeRecipient',{eventId:e.id,playerId:'friend',phone:'+34 600 000 000',reason:'收款人'},after),/有账号的球友/);
 await apply(s,owner,'feeRecipient',{eventId:e.id,playerId:'p3',phone:'+34 600 000 000',reason:'收款人'},after);
 assert.deepEqual(e.feeRecipient,{name:'carol',phone:'+34 600 000 000',playerId:'p3'});assert.equal(s.settings.feePayees![0].playerId,'p3');
 await confirm(s,e.id);const v=latest(s);
 assert.equal(v.collector,'p3');
 assert.deepEqual(v.transfers,[{from:'p0',to:'p3',cents:840},{from:'p3',to:'p1',cents:720},{from:'p3',to:'p2',cents:360}],'Carol collects 8.40 and, with her own 2.40, repays Alice and Bob');
 assert.ok(!playerSettled(s.payments,v,'p3'),'the collector still has to pass the money on');
 // Her status shows what she still has to repay, not an unpaid share of her own.
 assert.equal(collectorRepayment(s.payments,v,'p3'),1080);assert.equal(collectorRepayment(s.payments,v,'p0'),null,'others keep the usual status');
 await apply(s,carol,'feeTransferPaid',{eventId:e.id,settlementId:v.id,from:'p3',to:'p1',paid:true,reason:''},after+hour);
 assert.equal(collectorRepayment(s.payments,v,'p3'),360);
 await apply(s,carol,'feeTransferPaid',{eventId:e.id,settlementId:v.id,from:'p3',to:'p2',paid:true,reason:''},after+hour);
 assert.equal(collectorRepayment(s.payments,v,'p3'),0,'all repaid');assert.ok(playerSettled(s.payments,v,'p3'));
});

test('the club-subsidised part of an advanced court is owed by the owner',async()=>{
 const {s,e}=await fixture();
 await apply(s,owner,'bookingBearer',{bookingId:s.bookings[1].id,bearer:'subsidy',reason:'群补贴'},after);
 await confirm(s,e.id);const v=latest(s);
 const sum=(id:string,dir:'from'|'to')=>v.transfers!.filter(t=>t[dir]===id).reduce((n,t)=>n+t.cents,0);
 assert.equal(v.subsidy,1200);const share=(id:string)=>v.bills.find(b=>b.playerId===id)!.total;
 assert.equal(share('p2'),600,'nobody shares the subsidised court any more');assert.equal(sum('p2','to')-sum('p2','from'),1200-share('p2'),'Bob is repaid his whole 12 € advance, less his own share');
 assert.equal(sum('p0','from')-sum('p0','to'),v.bills.find(b=>b.playerId==='p0')!.total+1200,'the owner pays their share plus the subsidy');
});

test('each transfer is marked by its payer, receiver or an organiser; nobody else, and a new version keeps the marks',async()=>{
 const {s,e}=await fixture();await confirm(s,e.id);const v=latest(s);
 const mark=(a:Account,from:string,to:string,paid=true)=>apply(s,a,'feeTransferPaid',{eventId:e.id,settlementId:v.id,from,to,paid,reason:''},after+hour);
 await assert.rejects(()=>mark(alice,'p3','p2'),/403/);
 await assert.rejects(()=>apply(s,carol,'feePaid',{eventId:e.id,settlementId:v.id,playerId:'p3',paid:true,reason:''},after),/标记每一笔转账/);
 await mark(carol,'p3','p2');assert.ok(playerSettled(s.payments,v,'p3'));
 await mark(alice,'p0','p1');assert.ok(!playerSettled(s.payments,v,'p0'),'the owner still owes Bob');
 await mark(bob,'p0','p2');assert.ok(playerSettled(s.payments,v,'p0'),'the receiver can confirm a transfer');
 assert.deepEqual(openTransfers(s.payments,v),[]);
 await assert.rejects(()=>apply(s,owner,'notifyFees',{eventId:e.id,settlementId:v.id,reason:'提醒'},after+2*hour),/都已标记付款/);
 await mark(bob,'p0','p2',false);assert.deepEqual(openTransfers(s.payments,v),[{from:'p0',to:'p2',cents:120}]);
});

test('new activities need every advancer; older ones keep the old way until all are filled in',async()=>{
 const {s,e}=await fixture();
 await assert.rejects(()=>apply(s,owner,'cost',{eventId:e.id,type:'other',name:'水',pricing:'total',cents:300,used:0,start:null,end:null,bearer:'members',reason:''},after),/谁付的/);
 await assert.rejects(()=>apply(s,owner,'event',{title:'无人约场',matchFormat:'doubles',start,end,venue:'馆',address:'',capacity:8,cancelDeadline:start-86400000,note:'',status:'open',bookings:[{name:'1号场',start,end,pricing:'hourly',cents:1200}]},start-86400000));
 await assert.rejects(()=>apply(s,owner,'event',{title:'朋友约场',matchFormat:'doubles',start,end,venue:'馆',address:'',capacity:8,cancelDeadline:start-86400000,note:'',status:'open',bookings:[{name:'1号场',start,end,pricing:'hourly',cents:1200,advancedBy:'friend'}]},start-86400000),/约场的球友/);
 // An activity from before: no flag, no advancers. It confirms and is paid as before.
 const old=await fixture();delete old.e.feeAdvances;for(const x of [...old.s.bookings,...old.s.costs])delete x.advancedBy;
 await confirm(old.s,old.e.id);const before=latest(old.s);assert.equal(before.transfers,undefined);assert.ok(unpaidBills(old.s,before).length===5);
 // Filling in every advancer changes the result, so the organiser confirms a new version that uses transfers.
 for(const [item,by] of [[old.s.bookings[0].id,'p1'],[old.s.bookings[1].id,'p2'],[old.s.costs[0].id,'p3']])await apply(old.s,owner,'feeAdvance',{eventId:old.e.id,itemId:item,advancedBy:by,reason:''},after);
 const recalculated=calculateSettlement(old.s,old.e,after);assert.ok(recalculated.transfers);assert.equal(sameSettlement(recalculated,before),false);
 // A partial fill stays on the old way.
 const partial=await fixture();delete partial.e.feeAdvances;delete partial.s.costs[0].advancedBy;assert.equal(calculateSettlement(partial.s,partial.e,after).transfers,undefined);
 await assert.rejects(()=>{const x=structuredClone(partial);x.e.feeAdvances=true;x.s.events[0].feeAdvances=true;return confirm(x.s,x.e.id)},/垫付人/);
});

test('transfer planning balances exactly and needs at most one transfer fewer than the people involved',()=>{
 let seed=7;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647};
 for(let round=0;round<300;round++){
  const people=Array.from({length:2+Math.floor(rnd()*9)},(_,i)=>'m'+i),bills=people.map(id=>({playerId:id,total:Math.floor(rnd()*3000)}));
  const owed=bills.reduce((n,b)=>n+b.total,0),subsidy=round%3?0:Math.floor(rnd()*500),advancers=people.filter(()=>rnd()<.4),list=advancers.length?advancers:[people[0]];
  const parts=list.map(()=>rnd()),sum=parts.reduce((a,b)=>a+b,0);let left=owed+subsidy;
  const advances=list.map((id,i)=>{const cents=i===list.length-1?left:Math.floor((owed+subsidy)*parts[i]/sum);left-=cents;return {playerId:id,cents}});
  for(const collector of [undefined,people[Math.floor(rnd()*people.length)]]){
   const plan=planTransfers(bills,advances,subsidy,people[0],collector)!,net=new Map<string,number>();
   for(const t of plan){assert.ok(t.cents>0&&t.from!==t.to);net.set(t.from,(net.get(t.from)??0)-t.cents);net.set(t.to,(net.get(t.to)??0)+t.cents)}
   for(const id of people){const expected=(advances.find(a=>a.playerId===id)?.cents??0)-(bills.find(b=>b.playerId===id)!.total)-(id===people[0]?subsidy:0);assert.equal(net.get(id)??0,expected,'round '+round)}
   if(!collector)assert.ok(plan.length<=people.length-1);
  }
 }
});

test('advancers are shown what they actually paid; per-person rounding is spread over them, not skewed to the longest part',async()=>{
 // One court booked in two parts at 6.90 €/hour (Alice 2 h, Bob 1 h) and 7 € of balls from Carol, eight players all
 // three hours. Each share is 20.70/8 + 7/8 = 3.4625 €, rounded up to 3.47; the 6 cents above the costs used to make
 // the advances 13.84 / 6.88 / 7.04.
 const s=emptyState();s.settings.initialized=true;s.settings.ownerAccountId=owner.id;
 const accounts=[owner,alice,bob,carol,...[4,5,6,7].map(i=>({id:'m'+i,email:'',role:'member' as const,playerId:'p'+i}))];s.accounts=accounts.map(a=>({...a}));
 s.players=s.accounts.map(a=>({id:a.playerId,name:a.id,ownerId:a.id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''}));
 await apply(s,owner,'event',{title:'虚构分段订场',matchFormat:'doubles',start,end,venue:'虚构球馆',address:'',capacity:8,cancelDeadline:start-86400000,note:'',status:'open',
  bookings:[{name:'1号场',start,end:start+2*hour,pricing:'hourly',cents:690,advancedBy:'p1'},{name:'1号场',start:start+2*hour,end,pricing:'hourly',cents:690,advancedBy:'p2'}]},start-2*86400000);
 const e=s.events[0];
 s.accounts.forEach((a,i)=>s.registrations.push({id:'r'+i,eventId:e.id,playerId:a.playerId,sequence:i,status:'confirmed',arrival:start,departure:end,registeredAt:start-86400000,note:'',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''}}));
 await apply(s,owner,'cost',{eventId:e.id,type:'ball',name:'虚构球',pricing:'unit',cents:700,used:1,start:null,end:null,bearer:'members',advancedBy:'p3',reason:'耗球'},after);
 const v=calculateSettlement(s,e,after),billed=v.bills.reduce((n,b)=>n+b.total,0);
 assert.deepEqual(v.advances!.map(a=>[a.playerId,a.paid??a.cents]),[['p1',1380],['p2',690],['p3',700]],'what each advancer actually paid');
 assert.equal(v.advances!.reduce((n,a)=>n+a.cents,0),billed,'repayments still balance what members owe');
 assert.ok(v.advances!.every(a=>Math.abs(a.cents-(a.paid??a.cents))<=4),'only the rounding cents are added');
});
