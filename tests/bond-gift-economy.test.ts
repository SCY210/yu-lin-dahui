import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyState} from '../lib/domain/types';
import {treasureProduct,treasureRedeem} from '../lib/domain/treasure-shop';
import {appendTreasureLedger} from '../lib/domain/treasure-ledger';
import {bondRows,bondPairs,bondHistory,giftNotices,productGiftPoints,recordedGiftPoints,bondTierIndex} from '../lib/domain/bonds';

test('instant gifts are supplementary: no bulk advantage and five hundred thousand coins to gift the top tier',()=>{
 for(const price of [10,30,80])assert.equal(productGiftPoints({kind:'gift',price})/price,1);
 assert.equal(productGiftPoints({kind:'gift',price:10},8),productGiftPoints({kind:'gift',price:80}));
 assert.equal(bondTierIndex(productGiftPoints({kind:'gift',price:288})),0);
 assert.equal(productGiftPoints({kind:'gift',price:500000}),500000);
 assert.equal(recordedGiftPoints({delta:-20}),1000,'legacy gift value is preserved');
 assert.equal(recordedGiftPoints({delta:0,giftValue:20,giftAffinity:200}),200);
});

test('snapshotted affinity survives product repricing; both members, pairs, cache and notice agree',()=>{
 const s=emptyState();s.settings.ownerAccountId='owner';
 s.accounts=[{id:'owner',role:'admin',playerId:'a',email:''},{id:'member',role:'member',playerId:'b',email:''}];
 s.players=s.accounts.map(a=>({id:a.playerId,ownerId:a.id,name:'Fictional '+a.id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''}));
 appendTreasureLedger(s,{playerId:'a',delta:100,kind:'grant',actor:'owner',at:0,requestId:'setup',reason:'fictional'});
 const p=treasureProduct(s,s.accounts[0],{name:'Fictional gift',description:'',kind:'gift',price:10,stock:20,active:true},1);
 const input={productId:p.id,quantity:2,expectedPrice:10,expectedAffinity:20,giftTo:'b',requestId:crypto.randomUUID()};
 const order=treasureRedeem(s,s.accounts[0],input,2);assert.equal(order.giftAffinity,20);
 const once=structuredClone(s);treasureRedeem(s,s.accounts[0],input,3);assert.deepEqual(s,once);
 for(const expectedAffinity of [200,1000]){assert.throws(()=>treasureRedeem(s,s.accounts[0],{...input,requestId:crypto.randomUUID(),expectedAffinity},3),/409/);assert.deepEqual(s,once)}
 treasureProduct(s,s.accounts[0],{id:p.id,expectedVersion:p.version,name:p.name,description:'',kind:'gift',price:80,stock:p.stock,active:true},4);
 for(const [from,to]of [['a','b'],['b','a']]){assert.equal(bondRows(s,from).find(r=>r.playerId===to)?.score,20);assert.equal(bondHistory(s).rowFor(from).find(r=>r.playerId===to)?.score,20)}
 assert.equal(bondPairs(s)[0].score,20);assert.equal(bondHistory(s).pairs()[0].score,20);assert.equal(giftNotices(s,s.accounts[1],5)[0].affinity,20);
 // A historical unsnapshotted gift keeps its old conversion when replayed beside the new receipt.
 appendTreasureLedger(s,{playerId:'a',delta:-2,kind:'gift_sent',actor:'owner',at:6,requestId:'legacy',reason:'legacy',giftTo:'b',giftValue:2});
 appendTreasureLedger(s,{playerId:'b',delta:2,kind:'gift_received',actor:'owner',at:6,requestId:'gift:legacy',reason:'legacy',giftFrom:'a',giftValue:2});
 assert.equal(bondRows(s,'a')[0].score,120);assert.equal(bondRows(s,'b')[0].score,120);assert.equal(bondPairs(s)[0].score,120);assert.equal(bondHistory(s).pairs()[0].score,120);
});
