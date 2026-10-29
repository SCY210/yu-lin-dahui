import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,type Match,type State} from '../lib/domain/types';
import {apply} from '../lib/domain/commands';
import {bondRows,bondPairs,bondHistory,bondTierIndex,bondTiers,bondView,giftNotices,bondGamePoints,bondWinPoints,bondCoinPoints} from '../lib/domain/bonds';
import {treasureBalance,treasureProduct,treasureOrder,treasureShopView} from '../lib/domain/treasure-shop';
import {appendTreasureLedger} from '../lib/domain/treasure-ledger';
import {projectClubState} from '../lib/club-view';
import {clearSharedClubValues} from '../lib/club-view-shared';

const week=7*86400000,start=Date.parse('2027-01-02T10:00:00Z');
function fixture(){
 const s=emptyState();s.settings.initialized=true;
 for(const [i,name] of ['Fictional Owner','Fictional Ann','Fictional Ben','Fictional Cai','Fictional Dee'].entries()){
  const id='p'+i;s.accounts.push({id:'a'+i,playerId:id,role:i===0?'admin':'member',email:''});
  s.players.push({id,name,ownerId:'a'+i,enabled:true,initialRating:1000,rating:1000,ratedGames:0,ratingReason:''});
 }
 s.settings.ownerAccountId='a0';
 return s;
}
const account=(s:State,i:number)=>s.accounts[i];
let matchId=0;
function play(s:State,at:number,a:string[],b:string[],games:[number,number][]){
 const m={id:'m'+String(++matchId).padStart(6,'0'),eventId:'e',roundId:'r',courtId:'c',a,b,status:'complete',start:at,end:at+20*60000,scoreA:null,scoreB:null,monthly:true,elo:true,locked:true,enteredBy:null,games:games.map(([x,y])=>({a:x,b:y}))} as unknown as Match;
 s.matches.push(m);return m;
}
const coins=(s:State,playerId:string,amount:number,at=start)=>appendTreasureLedger(s,{playerId,delta:amount,kind:'grant',reason:'test coins',actor:'a0',at,requestId:crypto.randomUUID()});
const bond=(s:State,from:string,to:string)=>bondRows(s,from).find(r=>r.playerId===to);

test('bond stages follow the reference table, from 萍水相逢 at 0 to 莫逆之交 at 500000',()=>{
 assert.deepEqual(bondTiers.map(t=>[t.name,t.min]),[['萍水相逢',0],['泛泛之交',300],['金兰之契',1500],['朝夕相处',5000],['风雨同舟',15000],['情同手足',50000],['心有灵犀',80000],['生死与共',150000],['珠联璧合',250000],['情比金坚',350000],['莫逆之交',500000]]);
 assert.equal(bondTierIndex(0),0);assert.equal(bondTierIndex(299),0);assert.equal(bondTierIndex(300),1);assert.equal(bondTierIndex(499999),9);assert.equal(bondTierIndex(500000),10);assert.equal(bondTierIndex(9e9),10);
});

test('partners who play together weekly reach 泛泛之交 in a month, 风雨同舟 in about half a year and 莫逆之交 in about three years',()=>{
 const s=fixture(),stages:number[]=[];
 for(let w=0;w<160;w++){
  // Three games a week as partners, winning about half of them.
  play(s,start+w*week,['p1','p2'],['p3','p4'],w%2?[[21,15],[18,21],[21,19]]:[[21,15],[18,21],[17,21]]);
  stages.push(bondTierIndex(bond(s,'p1','p2')!.score));
 }
 assert.equal(stages[3],1,'after four weeks: 泛泛之交');
 assert.ok(stages[25]>=4&&stages[25]<=5,'after half a year: 风雨同舟 or just past it, got '+stages[25]);
 assert.ok(stages[103]<10,'not 莫逆之交 within two years');
 const top=stages.indexOf(10);assert.ok(top>=130&&top<=160,'莫逆之交 after about three years, got week '+top);
});

test('only partners gain from games; both members see the same score; each game is boosted by the stage reached so far',()=>{
 const s=fixture();
 play(s,start,['p1','p2'],['p3','p4'],[[21,10],[15,21]]);
 assert.deepEqual(bond(s,'p1','p2'),{playerId:'p2',score:2*bondGamePoints+bondWinPoints,games:2,wins:1,giftsSent:0,giftsReceived:0});
 assert.equal(bond(s,'p2','p1')!.score,bond(s,'p1','p2')!.score);
 assert.equal(bond(s,'p1','p3'),undefined,'opponents gain nothing');
 play(s,start+1000,['p1'],['p2'],[[21,5]]);
 assert.equal(bond(s,'p1','p2')!.games,2,'singles has no partner');
 for(let i=0;i<4;i++)play(s,start+week*(i+1),['p1','p2'],['p3','p4'],[[21,10]]);
 // Four more wins of 100 each: 萍水相逢 and 泛泛之交 both keep a boost of 1.
 assert.equal(bond(s,'p1','p2')!.score,160+400);
 const pair=fixture();for(let i=0;i<15;i++)play(pair,start+i,['p1','p2'],['p3','p4'],[[21,10]]);
 assert.equal(bond(pair,'p1','p2')!.score,1500,'fifteen wins reach 金兰之契 exactly');
 play(pair,start+week,['p1','p2'],['p3','p4'],[[21,10]]);
 assert.equal(bond(pair,'p1','p2')!.score,1500+2*(bondGamePoints+bondWinPoints),'金兰之契 doubles every later game');
});

test('members cannot give each other coins, so nobody can pool coins',async()=>{
 const s=fixture();coins(s,'p1',100);
 await assert.rejects(()=>apply(s,account(s,1),'bondGift',{toPlayerId:'p2',coins:30,requestId:crypto.randomUUID()},start),/403/);
 await assert.rejects(()=>apply(s,account(s,1),'treasureGrant',{playerId:'p2',amount:30,reason:'x',requestId:crypto.randomUUID()},start),/403/);
 assert.equal(treasureBalance(s,'p1'),100);assert.equal(treasureBalance(s,'p2'),0);assert.equal(bond(s,'p1','p2'),undefined);
});

test('coin gifts recorded while they were allowed still count and are announced once',async()=>{
 const s=fixture(),requestId=crypto.randomUUID();coins(s,'p1',100);
 appendTreasureLedger(s,{playerId:'p1',delta:-30,kind:'gift_sent',reason:'gift',actor:'a1',at:start+1000,requestId,giftTo:'p2',giftValue:30});
 appendTreasureLedger(s,{playerId:'p2',delta:30,kind:'gift_received',reason:'gift',actor:'a1',at:start+1000,requestId:'gift:'+requestId,giftFrom:'p1',giftValue:30,message:'谢谢搭档'});
 assert.deepEqual(bond(s,'p1','p2'),{playerId:'p2',score:30*bondCoinPoints,games:0,wins:0,giftsSent:30,giftsReceived:0});
 assert.equal(bond(s,'p2','p1')!.score,30*bondCoinPoints);assert.equal(bond(s,'p2','p1')!.giftsReceived,30);
 const [notice]=giftNotices(s,account(s,2),start+2000);
 assert.deepEqual({...notice,id:undefined},{id:undefined,fromPlayerId:'p1',coins:30,value:30,message:'谢谢搭档',at:start+1000});
 assert.deepEqual(giftNotices(s,account(s,1),start+2000),[],'the giver gets no notice');
 await apply(s,account(s,2),'giftSeen',{ids:[notice.id]},start+3000);
 assert.deepEqual(giftNotices(s,s.accounts[2],start+4000),[]);
});

test('a shop gift request is idempotent and checked: no gifts to oneself or to friends, notes up to 60 characters',async()=>{
 const s=fixture();coins(s,'p1',50);const requestId=crypto.randomUUID();
 const product=treasureProduct(s,account(s,0),{name:'Fictional shuttles',description:'',price:10,stock:9,kind:'physical',active:true},start);
 const gift=(extra:object)=>apply(s,account(s,1),'treasureRedeem',{productId:product.id,expectedPrice:10,quantity:1,giftTo:'p2',requestId:crypto.randomUUID(),...extra},start);
 await gift({requestId});await gift({requestId});
 assert.equal(treasureBalance(s,'p1'),40,'a replay does not give twice');assert.equal(s.treasureOrders.length,1);
 await assert.rejects(()=>gift({requestId,giftTo:'p3'}),/请求编号/);
 await assert.rejects(()=>gift({giftTo:'p1'}),/自己/);
 s.players.push({id:'guest',name:'Fictional Guest',ownerId:'a1',enabled:true,initialRating:1000,rating:1000,ratedGames:0,ratingReason:'',guestEventId:'e'});
 await assert.rejects(()=>gift({giftTo:'guest'}),/正式球友/);
 await assert.rejects(()=>gift({message:'x'.repeat(61)}),/60/);
 assert.equal(treasureBalance(s,'p1'),40);
 assert.equal(giftNotices(s,account(s,2),start+31*86400000).length,0,'old gifts are not brought up again');
});

test('a shop gift is bought by the giver, raises the bond, is announced to the receiver and is undone when the order is cancelled',async()=>{
 const s=fixture();coins(s,'p1',100);
 const owner=account(s,0),product=treasureProduct(s,owner,{name:'Fictional grip tape',description:'',price:12,stock:5,kind:'physical',active:true},start);
 await apply(s,account(s,1),'treasureRedeem',{productId:product.id,expectedPrice:12,quantity:2,giftTo:'p2',message:'生日快乐',requestId:crypto.randomUUID()},start+1000);
 assert.equal(treasureBalance(s,'p1'),76);assert.equal(treasureBalance(s,'p2'),0,'the receiver gets the item, not coins');
 const order=s.treasureOrders[0];assert.equal(order.playerId,'p1');assert.equal(order.giftTo,'p2');assert.equal(order.message,'生日快乐');
 assert.equal(bond(s,'p1','p2')!.score,24*bondCoinPoints);assert.equal(bond(s,'p2','p1')!.score,24*bondCoinPoints);
 const [notice]=giftNotices(s,account(s,2),start+2000);
 assert.equal(notice.item,'Fictional grip tape × 2');assert.equal(notice.value,24);assert.equal(notice.coins,0);assert.equal(notice.message,'生日快乐');
 assert.equal(treasureShopView(s,owner).orders[0].giftTo,'p2','the owner sees whom to hand it to');
 await assert.rejects(()=>apply(s,account(s,1),'treasureRedeem',{productId:product.id,expectedPrice:12,giftTo:'p1',requestId:crypto.randomUUID()},start),/自己/);
 treasureOrder(s,owner,{id:order.id,status:'cancelled'},start+3000);
 assert.equal(treasureBalance(s,'p1'),100);assert.equal(bond(s,'p1','p2'),undefined);assert.equal(bond(s,'p2','p1'),undefined);
 assert.deepEqual(giftNotices(s,account(s,2),start+4000),[]);
});

test('the list of every pair agrees with what each member sees of their own bonds',async()=>{
 const s=fixture();coins(s,'p1',100);
 const product=treasureProduct(s,account(s,0),{name:'Fictional towel',description:'',price:10,stock:9,kind:'physical',active:true},start);
 for(let w=0;w<30;w++)play(s,start+w*week,w%3?['p1','p2']:['p1','p3'],w%3?['p3','p4']:['p2','p4'],[[21,15],[w%2?21:15,w%2?15:21]]);
 await apply(s,account(s,1),'treasureRedeem',{productId:product.id,expectedPrice:10,quantity:2,giftTo:'p4',requestId:crypto.randomUUID()},start+3*week);
 const pairs=bondPairs(s);
 assert.ok(pairs.length>=5);assert.deepEqual(pairs.map(p=>p.score),[...pairs.map(p=>p.score)].sort((x,y)=>y-x),'strongest first');
 for(const p of pairs){const row=bond(s,p.a,p.b)!;assert.equal(p.score,row.score,p.a+'-'+p.b);assert.equal(p.games,row.games);assert.equal(p.wins,row.wins);assert.equal(p.gifts,row.giftsSent+row.giftsReceived);assert.equal(bond(s,p.b,p.a)!.score,p.score)}
 assert.equal(pairs.find(p=>p.a==='p1'&&p.b==='p4')!.gifts,20);
 assert.ok(!pairs.some(p=>p.a==='p0'||p.b==='p0'),'members who never partnered have no pair');
});

test('the club view shows each member only their own bonds and gifts; the owner and administrators also see every pair',async()=>{
 const s=fixture();coins(s,'p1',20);
 const product=treasureProduct(s,account(s,0),{name:'Fictional towel',description:'',price:10,stock:9,kind:'physical',active:true},start);
 play(s,start,['p1','p2'],['p3','p4'],[[21,10]]);
 play(s,start+1000,['p3','p4'],['p1','p2'],[[21,10]]);
 await apply(s,account(s,1),'treasureRedeem',{productId:product.id,expectedPrice:10,quantity:1,giftTo:'p2',message:'Fictional thanks',requestId:crypto.randomUUID()},start+2000);
 const now=start+3000,view=(i:number)=>projectClubState(s,account(s,i),'2027-01',2027,now) as unknown as {bonds:ReturnType<typeof bondView>;me:{giftNotices:unknown[]}};
 assert.deepEqual(view(1).bonds.rows.map(r=>r.playerId),['p2']);assert.ok(!('giftable' in view(1).bonds));
 assert.deepEqual(view(3).bonds.rows.map(r=>[r.playerId,r.score]),[['p4',bondGamePoints*2+bondWinPoints]],'p3 sees only their own partner');
 assert.equal(view(2).me.giftNotices.length,1);assert.equal(view(3).me.giftNotices.length,0);
 assert.ok(!JSON.stringify(view(3)).includes('Fictional thanks'),'other members never see the note');
 assert.ok(!('pairs' in view(1).bonds)&&!('pairs' in view(3).bonds),'members never see other pairs');
 assert.deepEqual(view(0).bonds.pairs!.map(p=>[p.a,p.b]),[['p1','p2'],['p3','p4']],'the owner sees every pair');
 s.accounts[0].role='member';assert.ok(view(0).bonds.pairs,'the owner sees every pair whatever their role');
 s.accounts[4].role='admin';assert.ok(view(4).bonds.pairs,'administrators see every pair');
});

test('indexed bond history preserves both ledger sides, game ordering, guest conversion and cancelled gifts',()=>{
 const s=fixture();coins(s,'p1',100);
 s.players.push({...s.players[1],id:'guest',guestEventId:'e'});
 for(let i=0;i<24;i++)play(s,start+(i%5)*1000,i%3?['p1','p2']:['p1','guest'],['p3','p4'],[[21,15],[17,21],[21,19]]);
 play(s,start,['p1'],['p2'],[[21,15]]);
 const incomplete=play(s,start,['p1','p2'],['p3','p4'],[[21,15]]);incomplete.end=null;
 const cancelled=play(s,start,['p1','p2'],['p3','p4'],[[21,15]]);cancelled.status='cancelled';
 s.matches.reverse();
 // Unequal legacy sides must not be reconstructed from the giver's administrative pair total.
 appendTreasureLedger(s,{playerId:'p1',delta:-7,kind:'gift_sent',reason:'legacy',actor:'a1',at:start+1000,requestId:'legacy',giftTo:'p2'});
 appendTreasureLedger(s,{playerId:'p2',delta:0,kind:'gift_received',reason:'legacy',actor:'a1',at:start+1000,requestId:'gift:legacy',giftFrom:'p1',giftValue:11});
 appendTreasureLedger(s,{playerId:'p4',delta:0,kind:'gift_received',reason:'legacy',actor:'a1',at:start+1000,requestId:'gift:receipt-only',giftFrom:'p1',giftValue:5});
 appendTreasureLedger(s,{playerId:'p1',delta:-20,kind:'gift_sent',reason:'cancelled',actor:'a1',at:start,requestId:'cancelled',giftTo:'p3',orderId:'cancelled-order'});
 s.treasureOrders.push({id:'cancelled-order',status:'cancelled'} as State['treasureOrders'][number]);
 for(const converted of [false,true]){
  if(converted)s.accounts.push({id:'guest-account',playerId:'guest',role:'member',email:''});
  const before=structuredClone(s),history=bondHistory(s);
  assert.deepEqual(history.pairs(),bondPairs(s));
  for(const player of s.players)assert.deepEqual(history.rowFor(player.id),bondRows(s,player.id),player.id);
  for(const viewer of s.accounts)assert.deepEqual(bondView(s,viewer,undefined,history),bondView(s,viewer));
  assert.equal(history.rowFor('p1').some(row=>row.playerId==='guest'),converted);
  assert.equal(history.rowFor('p1').find(row=>row.playerId==='p2')?.giftsSent,7);
  assert.equal(history.rowFor('p2').find(row=>row.playerId==='p1')?.giftsReceived,11);
  assert.deepEqual(s,before,'history construction never mutates the source');
 }
});

test('shared bond history authorizes each viewer and isolates mutable response rows',()=>{
 const s=fixture();play(s,start,['p1','p2'],['p3','p4'],[[21,15]]);
 const history=bondHistory(s),member=account(s,1),admin=account(s,0);
 const values=()=>({rows:s.players.map(player=>history.rowFor(player.id)),pairs:history.pairs()}),expected=structuredClone(values());
 const first=bondView(s,member,undefined,history);assert.ok(!('pairs' in first));first.rows[0].score=-1;first.rows.push({...first.rows[0],playerId:'injected'});
 const privileged=bondView(s,admin,undefined,history);privileged.pairs![0].score=-1;privileged.pairs!.length=0;
 assert.deepEqual(values(),expected);
 assert.deepEqual(bondView(s,member,undefined,history),bondView(s,member));
 member.role='admin';assert.deepEqual(bondView(s,member,undefined,history).pairs,bondPairs(s));
 member.role='member';assert.ok(!('pairs' in bondView(s,member,undefined,history)),'a prior administrator response grants no access');
 admin.role='member';assert.deepEqual(bondView(s,admin,undefined,history).pairs,bondPairs(s),'the owner still sees pairs');
});

test('lazy bond replay computes only requested results once from an independent snapshot',()=>{
 const s=fixture();coins(s,'p1',30);play(s,start,['p1','p2'],['p3','p4'],[[21,15]]);
 appendTreasureLedger(s,{playerId:'p1',delta:-7,kind:'gift_sent',reason:'legacy',actor:'a1',at:start+1000,requestId:'lazy-gift',giftTo:'p2',giftValue:7});
 const expectedRows=bondRows(s,'p1'),expectedPairs=bondPairs(s),history=bondHistory(s);
 // Mutate the original request before either lazy replay; cached facts must remain an independent snapshot.
 s.matches[0].a[1]='p3';s.matches[0].games[0].a=10;s.treasureLedger.at(-1)!.giftValue=999;
 s.accounts.length=0;s.players.length=0;
 const sort=Array.prototype.sort;let sorts=0;
 Array.prototype.sort=function(...args){sorts++;return sort.apply(this,args)};
 try{
  const first=history.rowFor('p1');assert.deepEqual(first,expectedRows);assert.ok(sorts>0);
  sorts=0;assert.strictEqual(history.rowFor('p1'),first);assert.equal(sorts,0,'member replay is memoized');
  const pairs=history.pairs();assert.deepEqual(pairs,expectedPairs);assert.ok(sorts>0,'pairs were not eagerly computed with the member');
  sorts=0;assert.strictEqual(history.pairs(),pairs);assert.equal(sorts,0,'pair replay is memoized');
 }finally{Array.prototype.sort=sort}
 const member=fixture().accounts[1];
 const onlyMember={rowFor:()=>expectedRows,pairs:()=>{throw new Error('Member must not request administrative pairs')}};
 assert.deepEqual(bondView(fixture(),member,undefined,onlyMember).rows,expectedRows);
});

test('bond replays build guest membership once instead of scanning accounts for every game',()=>{
 const s=fixture();for(let i=0;i<200;i++)play(s,start+i,['p1','p2'],['p3','p4'],[[21,15],[17,21],[21,19]]);
 const players=s.players,accounts=s.accounts;let reads=0;
 Object.defineProperty(s,'players',{get:()=>{reads++;return players}});
 Object.defineProperty(s,'accounts',{get:()=>{reads++;return accounts}});
 for(const replay of [()=>bondRows(s,'p1'),()=>bondPairs(s),()=>bondHistory(s)]){
  reads=0;replay();assert.ok(reads<=3,`guest membership read ${reads} collections for one replay`);
 }
});

test('club projections share bond facts across scopes while checking every viewer and current role',()=>{
 clearSharedClubValues();
 try{
  const s=fixture(),now=start+3600000;s.revision=701;
  s.events.push({id:'e',title:'Fictional event',creatorId:'a0',start,end:now,venue:'Fictional court',address:'',capacity:8,signupDeadline:start,cancelDeadline:start,note:'',status:'ended',courtMode:'equal',ballMode:'equal'});
  play(s,start,['p1','p2'],['p3','p4'],[[21,15]]);
  const full=(i:number)=>projectClubState(s,account(s,i),'2027-01',2027,now,{revision:s.revision});
  const activity=(i:number)=>projectClubState(s,account(s,i),'2027-01',2027,now,{revision:s.revision,activityId:'e'});
  const plain=(i:number)=>projectClubState(s,account(s,i),'2027-01',2027,now);
  // Start with a member's scoped read, then reuse the same history for privileged and full reads.
  assert.deepEqual(activity(1).bonds,plain(1).bonds);
  assert.deepEqual(full(0).bonds,plain(0).bonds);
  const edited=full(0);edited.bonds.pairs![0].score=-123;
  const member=activity(1);member.bonds.rows[0].score=-123;
  assert.deepEqual(full(0).bonds,plain(0).bonds);assert.deepEqual(full(1).bonds,plain(1).bonds);
  s.accounts[4].role='admin';assert.deepEqual(activity(4).bonds.pairs,plain(0).bonds.pairs);
  // Even before the normal revision invalidation, a role downgrade cannot reuse an administrative response.
  s.accounts[4].role='member';assert.ok(!('pairs' in full(4).bonds));assert.ok(!('pairs' in activity(4).bonds));
  s.accounts[0].role='member';assert.deepEqual(activity(0).bonds.pairs,plain(0).bonds.pairs,'owner privileges remain current');
 }finally{clearSharedClubValues()}
});

test('new stored revisions invalidate shared bonds after guest conversion, gifts and order cancellation',()=>{
 clearSharedClubValues();
 try{
  const s=fixture(),now=start+3600000;s.revision=801;coins(s,'p1',100);
  s.players.push({...s.players[1],id:'guest',guestEventId:'e'});
  play(s,start,['p1','guest'],['p3','p4'],[[21,15]]);
  const view=(i:number)=>projectClubState(s,account(s,i),'2027-01',2027,now,{revision:s.revision});
  const equalFresh=(i:number)=>{const cached=view(i),fresh=projectClubState(s,account(s,i),'2027-01',2027,now);assert.deepEqual(cached.bonds,fresh.bonds);assert.deepEqual(cached.me.giftNotices,fresh.me.giftNotices);return cached};
  assert.ok(!equalFresh(1).bonds.rows.some(row=>row.playerId==='guest'));
  s.accounts.push({id:'guest-account',playerId:'guest',role:'member',email:''});s.revision++;
  assert.ok(equalFresh(1).bonds.rows.some(row=>row.playerId==='guest'),'a converted guest is included immediately');
  appendTreasureLedger(s,{playerId:'p1',delta:-7,kind:'gift_sent',reason:'legacy',actor:'a1',at:start+1000,requestId:'new-gift',giftTo:'p2',giftValue:7,orderId:'gift-order'});
  appendTreasureLedger(s,{playerId:'p2',delta:0,kind:'gift_received',reason:'legacy',actor:'a1',at:start+1000,requestId:'gift:new-gift',giftFrom:'p1',giftValue:7,orderId:'gift-order',message:'Only the recipient sees this'});
  s.revision++;
  assert.equal(equalFresh(1).bonds.rows.find(row=>row.playerId==='p2')?.giftsSent,7);
  assert.equal(equalFresh(2).me.giftNotices.length,1);assert.equal(equalFresh(3).me.giftNotices.length,0);
  s.treasureOrders.push({id:'gift-order',status:'cancelled'} as State['treasureOrders'][number]);s.revision++;
  assert.ok(!equalFresh(1).bonds.rows.some(row=>row.playerId==='p2'));
  assert.equal(equalFresh(2).me.giftNotices.length,0);equalFresh(0);
 }finally{clearSharedClubValues()}
});
