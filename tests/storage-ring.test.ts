import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,type State} from '../lib/domain/types';
import {applyTreasure,storageRing,treasureBalance,treasureOrder,treasureProduct,treasureRedeem,treasureShopView} from '../lib/domain/treasure-shop';
import {appendTreasureLedger} from '../lib/domain/treasure-ledger';
import {hornBroadcasts} from '../lib/domain/horn';
import {bondRows,giftNotices,productGiftPoints} from '../lib/domain/bonds';

const hour=3600000;
function club(){
 const s:State=emptyState();s.settings.ownerAccountId='owner';
 s.accounts=[{id:'owner',role:'admin',playerId:'a',email:''},{id:'giver',role:'member',playerId:'b',email:''},{id:'receiver',role:'member',playerId:'c',email:''}];
 s.players=s.accounts.map(a=>({id:a.playerId,ownerId:a.id,name:'Fictional '+a.id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''}));
 appendTreasureLedger(s,{playerId:'b',delta:500,kind:'grant',actor:'owner',at:0,requestId:'setup',reason:'fictional'});
 const owner=s.accounts[0];
 const horn=treasureProduct(s,owner,{name:'传音喇叭',description:'',kind:'horn',price:1,stock:10,active:true,hornSpecs:[{hours:24,price:30},{hours:1,price:10}]},1);
 const jade=treasureProduct(s,owner,{name:'同心玉佩',description:'',kind:'gift',price:30,stock:10,active:true},1);
 const racket=treasureProduct(s,owner,{name:'Fictional racket',description:'',kind:'physical',price:100,stock:5,active:true},1);
 return {s,horn,jade,racket,owner,giver:s.accounts[1],receiver:s.accounts[2]};
}
const giftHorn=(over:Record<string,unknown>={})=>({quantity:1,expectedPrice:30,hornHours:24,giftTo:'c',message:'周末来打球',requestId:crypto.randomUUID(),...over});

test('a gifted horn charges the giver, waits unused in the receiver ring and is announced as a gift',()=>{
 const {s,horn,giver,receiver}=club();
 const order=treasureRedeem(s,giver,{productId:horn.id,...giftHorn({expectedAffinity:productGiftPoints({kind:'horn',price:30})})},10*hour);
 assert.equal(order.status,'fulfilled');assert.equal(order.giftTo,'c');assert.equal(order.hornText,undefined);assert.equal(order.hornEnd,undefined);
 assert.equal(treasureBalance(s,'b'),470);assert.equal(treasureBalance(s,'c'),0,'receiving moves no coins');assert.equal(s.treasureProducts[0].stock,9);
 assert.deepEqual(hornBroadcasts(s,11*hour),[],'nothing on air until the receiver uses it');
 const [notice]=giftNotices(s,receiver,11*hour);
 assert.equal(notice.horn,true);assert.equal(notice.instant,true);assert.equal(notice.affinity,30,'the instant rate, by the chosen duration price');assert.equal(notice.item,'传音喇叭 · 1 天');
 assert.equal(bondRows(s,'b').find(r=>r.playerId==='c')?.score,30);
 const [item]=storageRing(s,'c');
 assert.deepEqual(item,{id:order.id,productName:'传音喇叭',kind:'horn',quantity:1,status:'fulfilled',at:10*hour,fromPlayerId:'b',message:'周末来打球',hornHours:24});
 assert.deepEqual(storageRing(s,'b'),[],'what the giver gave away is not in their own ring');
 assert.deepEqual(treasureShopView(s,receiver).ring,[item]);
});

test('only the receiver uses a gifted horn; it goes on air from then, in their name, once',()=>{
 const {s,horn,owner,giver,receiver}=club();
 const order=treasureRedeem(s,giver,{productId:horn.id,...giftHorn()},hour);
 for(const someone of [giver,owner])assert.throws(()=>applyTreasure(s,someone,'treasureHornUse',{orderId:order.id,hornText:'hi'},2*hour),/储物戒里没有/);
 assert.throws(()=>applyTreasure(s,receiver,'treasureHornUse',{orderId:order.id,hornText:'第一行\n第二行'},2*hour),/换行/);
 assert.equal(applyTreasure(s,receiver,'treasureHornUse',{orderId:order.id,hornText:'谢谢道友！'},5*hour),true);
 assert.deepEqual(hornBroadcasts(s,6*hour),[{id:order.id,playerId:'c',hornText:'谢谢道友！',start:5*hour,end:29*hour}]);
 assert.deepEqual(hornBroadcasts(s,29*hour),[]);
 const once=structuredClone(s);
 applyTreasure(s,receiver,'treasureHornUse',{orderId:order.id,hornText:'谢谢道友！'},6*hour);assert.deepEqual(s,once,'a repeated request changes nothing');
 assert.throws(()=>applyTreasure(s,receiver,'treasureHornUse',{orderId:order.id,hornText:'换一句'},6*hour),/已经用过/);
 assert.equal(storageRing(s,'c')[0].hornText,'谢谢道友！');
 assert.equal(s.audits.at(-1)?.action,'treasureHornUse');
});

test('stale horn gift prices and affinity are refused before charging',()=>{
 const {s,horn,giver}=club();const before=structuredClone(s);
 assert.throws(()=>treasureRedeem(s,giver,{productId:horn.id,...giftHorn({expectedPrice:10})},1),/409/);
 assert.throws(()=>treasureRedeem(s,giver,{productId:horn.id,...giftHorn({expectedAffinity:1500})},1),/409/);
 assert.deepEqual(s,before);
});

test('the ring holds received gifts of every kind and own redemptions; refunded orders leave it',()=>{
 const {s,jade,racket,owner,giver,receiver}=club();
 treasureRedeem(s,giver,{productId:jade.id,quantity:2,expectedPrice:30,giftTo:'c',expectedAffinity:60,requestId:crypto.randomUUID()},1);
 const racketGift=treasureRedeem(s,giver,{productId:racket.id,quantity:1,expectedPrice:100,giftTo:'c',requestId:crypto.randomUUID()},2);
 const own=treasureRedeem(s,giver,{productId:racket.id,quantity:1,expectedPrice:100,requestId:crypto.randomUUID()},3);
 assert.deepEqual(storageRing(s,'c').map(i=>[i.productName,i.kind,i.quantity,i.status,i.fromPlayerId]),[['Fictional racket','physical',1,'pending','b'],['同心玉佩','gift',2,'fulfilled','b']]);
 assert.deepEqual(storageRing(s,'b').map(i=>[i.id,i.fromPlayerId]),[[own.id,undefined]]);
 treasureOrder(s,owner,{id:racketGift.id,status:'cancelled'},4);
 assert.deepEqual(storageRing(s,'c').map(i=>i.productName),['同心玉佩']);
 assert.equal(treasureShopView(s,receiver).ring.length,1);
});
