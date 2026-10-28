import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,type Match,type State} from '../lib/domain/types';
import {apply} from '../lib/domain/commands';
import {bondRows,bondTierIndex,bondTiers,bondView,giftNotices,giftableCoins,bondGamePoints,bondWinPoints,bondCoinPoints} from '../lib/domain/bonds';
import {treasureBalance,treasureProduct,treasureOrder,treasureShopView} from '../lib/domain/treasure-shop';
import {appendTreasureLedger} from '../lib/domain/treasure-ledger';
import {projectClubState} from '../lib/club-view';

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

test('giving coins moves them to the receiver, raises the bond and announces the gift once',async()=>{
 const s=fixture();coins(s,'p1',100);
 await apply(s,account(s,1),'bondGift',{toPlayerId:'p2',coins:30,message:'谢谢搭档',requestId:crypto.randomUUID()},start+1000);
 assert.equal(treasureBalance(s,'p1'),70);assert.equal(treasureBalance(s,'p2'),30);
 assert.deepEqual(bond(s,'p1','p2'),{playerId:'p2',score:30*bondCoinPoints,games:0,wins:0,giftsSent:30,giftsReceived:0});
 assert.equal(bond(s,'p2','p1')!.score,30*bondCoinPoints);assert.equal(bond(s,'p2','p1')!.giftsReceived,30);
 const [notice]=giftNotices(s,account(s,2),start+2000);
 assert.deepEqual({...notice,id:undefined},{id:undefined,fromPlayerId:'p1',coins:30,value:30,message:'谢谢搭档',at:start+1000});
 assert.deepEqual(giftNotices(s,account(s,1),start+2000),[],'the giver gets no notice');
 await apply(s,account(s,2),'giftSeen',{ids:[notice.id]},start+3000);
 assert.deepEqual(giftNotices(s,s.accounts[2],start+4000),[]);
 assert.equal(giftNotices(s,account(s,2),start+31*86400000).length,0,'old gifts are not brought up again');
});

test('a gift request is idempotent and checked: no gifts to oneself, to friends or beyond the giftable coins',async()=>{
 const s=fixture();coins(s,'p1',50);const requestId=crypto.randomUUID();
 await apply(s,account(s,1),'bondGift',{toPlayerId:'p2',coins:20,requestId},start);
 await apply(s,account(s,1),'bondGift',{toPlayerId:'p2',coins:20,requestId},start+1);
 assert.equal(treasureBalance(s,'p1'),30,'a replay does not give twice');
 await assert.rejects(()=>apply(s,account(s,1),'bondGift',{toPlayerId:'p3',coins:20,requestId},start+2),/请求编号/);
 await assert.rejects(()=>apply(s,account(s,1),'bondGift',{toPlayerId:'p1',coins:5,requestId:crypto.randomUUID()},start),/自己/);
 s.players.push({id:'guest',name:'Fictional Guest',ownerId:'a1',enabled:true,initialRating:1000,rating:1000,ratedGames:0,ratingReason:'',guestEventId:'e'});
 await assert.rejects(()=>apply(s,account(s,1),'bondGift',{toPlayerId:'guest',coins:5,requestId:crypto.randomUUID()},start),/正式球友/);
 await assert.rejects(()=>apply(s,account(s,1),'bondGift',{toPlayerId:'p2',coins:31,requestId:crypto.randomUUID()},start),/不足/);
 await assert.rejects(()=>apply(s,account(s,1),'bondGift',{toPlayerId:'p2',coins:5,message:'x'.repeat(61),requestId:crypto.randomUUID()},start),/60/);
 assert.equal(treasureBalance(s,'p1'),30);
});

test('coins received as a gift cannot be given back, so a pair cannot pass the same coins to raise their bond',async()=>{
 const s=fixture();coins(s,'p1',40);coins(s,'p2',10);
 await apply(s,account(s,1),'bondGift',{toPlayerId:'p2',coins:40,requestId:crypto.randomUUID()},start);
 assert.equal(treasureBalance(s,'p2'),50);assert.equal(giftableCoins(s,'p2'),10);
 await assert.rejects(()=>apply(s,account(s,2),'bondGift',{toPlayerId:'p1',coins:11,requestId:crypto.randomUUID()},start+1),/收到的赠礼只能兑换礼品/);
 await apply(s,account(s,2),'bondGift',{toPlayerId:'p3',coins:10,requestId:crypto.randomUUID()},start+2);
 assert.equal(giftableCoins(s,'p2'),0);assert.equal(treasureBalance(s,'p2'),40,'the received coins stay spendable in the shop');
 const owner=account(s,0),product=treasureProduct(s,owner,{name:'Fictional shuttles',description:'',price:15,stock:5,kind:'physical',active:true},start);
 await apply(s,account(s,2),'treasureRedeem',{productId:product.id,expectedPrice:15,quantity:1,requestId:crypto.randomUUID()},start+3);
 assert.equal(treasureBalance(s,'p2'),25);assert.equal(giftableCoins(s,'p2'),0,'shop spending uses received coins first');
 coins(s,'p2',5,start+4);assert.equal(giftableCoins(s,'p2'),5);
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

test('the club view shows each member only their own bonds and gifts',async()=>{
 const s=fixture();coins(s,'p1',20);
 play(s,start,['p1','p2'],['p3','p4'],[[21,10]]);
 play(s,start+1000,['p3','p4'],['p1','p2'],[[21,10]]);
 await apply(s,account(s,1),'bondGift',{toPlayerId:'p2',coins:10,message:'Fictional thanks',requestId:crypto.randomUUID()},start+2000);
 const now=start+3000,view=(i:number)=>projectClubState(s,account(s,i),'2027-01',2027,now) as unknown as {bonds:ReturnType<typeof bondView>;me:{giftNotices:unknown[]}};
 assert.deepEqual(view(1).bonds.rows.map(r=>r.playerId),['p2']);assert.equal(view(1).bonds.giftable,10);
 assert.deepEqual(view(3).bonds.rows.map(r=>[r.playerId,r.score]),[['p4',bondGamePoints*2+bondWinPoints]],'p3 sees only their own partner');
 assert.equal(view(2).me.giftNotices.length,1);assert.equal(view(3).me.giftNotices.length,0);
 assert.ok(!JSON.stringify(view(3)).includes('Fictional thanks'),'other members never see the note');
});
