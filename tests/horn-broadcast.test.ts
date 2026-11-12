import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,type State} from '../lib/domain/types';
import {treasureBalance,treasureProduct,treasureRedeem,applyTreasure} from '../lib/domain/treasure-shop';
import {appendTreasureLedger} from '../lib/domain/treasure-ledger';
import {formatHornSpecs,hornBroadcasts,nextHornEnd,parseHornSpecs} from '../lib/domain/horn';
import {maskClubContent} from '../lib/domain/blocked-words';
import {clubViewValidUntil} from '../lib/club-read-cache';

const hour=3600000;
function club(){
 const s:State=emptyState();s.settings.ownerAccountId='owner';
 s.accounts=[{id:'owner',role:'admin',playerId:'a',email:''},{id:'vice',role:'admin',playerId:'b',email:''},{id:'member',role:'member',playerId:'c',email:''}];
 s.players=s.accounts.map(a=>({id:a.playerId,ownerId:a.id,name:'Fictional '+a.id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''}));
 appendTreasureLedger(s,{playerId:'c',delta:100,kind:'grant',actor:'owner',at:0,requestId:'setup',reason:'fictional'});
 const p=treasureProduct(s,s.accounts[0],{name:'传音喇叭',description:'',kind:'horn',price:1,stock:10,active:true,hornSpecs:[{hours:24,price:30},{hours:1,price:10}]},1);
 return {s,p,owner:s.accounts[0],vice:s.accounts[1],member:s.accounts[2]};
}
const buy=(over:Record<string,unknown>={})=>({quantity:1,expectedPrice:30,hornHours:24,hornText:'周六一起打球！',requestId:crypto.randomUUID(),...over});

test('the owner sets duration options; the cheapest is the listed price and other kinds cannot carry them',()=>{
 const {s,p,owner}=club();
 assert.deepEqual(p.hornSpecs,[{hours:1,price:10},{hours:24,price:30}]);assert.equal(p.price,10);
 assert.throws(()=>treasureProduct(s,owner,{name:'x',description:'',kind:'horn',price:5,stock:1,active:true},2),/保留时长/);
 assert.throws(()=>treasureProduct(s,owner,{name:'x',description:'',kind:'physical',price:5,stock:1,active:true,hornSpecs:[{hours:1,price:5}]},2),/只有传音喇叭/);
 assert.throws(()=>treasureProduct(s,owner,{name:'x',description:'',kind:'horn',price:5,stock:1,active:true,hornSpecs:[{hours:1,price:5},{hours:1,price:6}]},2));
 const edited=treasureProduct(s,owner,{id:p.id,expectedVersion:p.version,name:p.name,description:'',kind:'digital',price:8,stock:1,active:true},3);
 assert.equal(edited.hornSpecs,undefined,'changing the kind drops the options');assert.equal(s.treasureProducts[0].hornSpecs,undefined);
});

test('buying a horn charges the chosen option and puts the text on the banner until it expires',()=>{
 const {s,p,member}=club();
 const order=treasureRedeem(s,member,{productId:p.id,...buy()},10*hour);
 assert.equal(order.status,'fulfilled');assert.equal(order.total,30);assert.equal(order.hornEnd,34*hour);assert.equal(order.hornText,'周六一起打球！');
 assert.equal(treasureBalance(s,'c'),70);assert.equal(s.treasureProducts[0].stock,9);
 assert.deepEqual(hornBroadcasts(s,11*hour),[{id:order.id,playerId:'c',hornText:'周六一起打球！',start:10*hour,end:34*hour}]);
 assert.equal(nextHornEnd(s,11*hour),34*hour);
 assert.deepEqual(hornBroadcasts(s,34*hour),[],'gone when the bought duration ends');
 assert.equal(nextHornEnd(s,34*hour),Infinity);
 assert.ok(clubViewValidUntil(s,member,11*hour)<=34*hour,'the conditional read expires when the banner changes');
});

test('a repeated request is one purchase; stale prices, unknown options and bad text are refused without charging',()=>{
 const {s,p,member}=club();
 const input={productId:p.id,...buy()};treasureRedeem(s,member,input,1);
 const once=structuredClone(s);treasureRedeem(s,member,input,2);assert.deepEqual(s,once);
 const refused:[Record<string,unknown>,RegExp][]=[
  [{expectedPrice:10},/409/],[{hornHours:6},/409/],[{hornText:'  '},/喇叭内容/],[{hornText:'x'.repeat(51)},/50/],[{hornText:'第一行\n第二行'},/换行/],
  [{quantity:2},/1 个/],[{giftTo:'a'},/对方自己填写/],[{giftTo:'c',hornText:undefined},/不能送给自己/],[{hornHours:undefined},/保留时长/],[{message:'hi'},/只有赠送/],
 ];
 for(const [over,message] of refused){assert.throws(()=>treasureRedeem(s,member,{productId:p.id,...buy(over)},3),message);assert.deepEqual(s,once)}
 assert.equal(treasureBalance(s,'c'),70);
});

test('ordinary products refuse horn fields',()=>{
 const {s,owner,member}=club();
 const gift=treasureProduct(s,owner,{name:'Fictional item',description:'',kind:'digital',price:5,stock:5,active:true},2);
 assert.throws(()=>treasureRedeem(s,member,{productId:gift.id,quantity:1,expectedPrice:5,hornText:'hi',requestId:crypto.randomUUID()},3),/只有传音喇叭/);
});

test('the owner and administrators can take a broadcast down early; members cannot, and coins stay spent',()=>{
 const {s,p,vice,member}=club();
 const order=treasureRedeem(s,member,{productId:p.id,...buy()},1);
 assert.throws(()=>applyTreasure(s,member,'treasureHornRemove',{orderId:order.id},2),/403/);
 assert.equal(applyTreasure(s,vice,'treasureHornRemove',{orderId:order.id},2),true);
 assert.deepEqual(hornBroadcasts(s,3),[]);assert.equal(s.treasureOrders[0].hornRemovedBy,'vice');
 assert.equal(treasureBalance(s,'c'),70,'no automatic refund');
 assert.equal(s.audits.at(-1)?.action,'treasureHornRemove');
});

test('blocked words mask the banner text in the club view; the stored text is kept',()=>{
 const {s,p,member}=club();
 treasureRedeem(s,member,{productId:p.id,...buy({hornText:'坏词 来打球'})},1);
 const view=maskClubContent({hornBroadcasts:hornBroadcasts(s,2)},['坏词']);
 assert.equal(view.hornBroadcasts[0].hornText,'** 来打球');assert.equal(s.treasureOrders[0].hornText,'坏词 来打球');
});

test('the owner writes options as one line each, in hours or days',()=>{
 assert.deepEqual(parseHornSpecs('3天 60\n1小时 10\n\n6 15 羽币\n1d:30'),{specs:[{hours:1,price:10},{hours:6,price:15},{hours:24,price:30},{hours:72,price:60}]});
 assert.equal(formatHornSpecs([{hours:72,price:60},{hours:6,price:15}]),'6小时 15\n3天 60');
 for(const bad of ['','一天 30','1天30','0小时 5','1小时 0','31天 5','1天 5\n24小时 6'])assert.ok('error' in parseHornSpecs(bad),bad);
});
