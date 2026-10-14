import {seedAccountNoticeFixture} from './helpers/account-notice.mjs';
// Real club handlers and transactions against isolated SQLite; never production.
import assert from 'node:assert/strict';
import {AsyncLocalStorage} from 'node:async_hooks';
import {build} from 'esbuild';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sqliteD1} from './helpers/sqlite-d1.mjs';

mkdirSync('.test-output',{recursive:true});
const fixture=globalThis.__treasureShopTest={env:{},identity:new AsyncLocalStorage()};
writeFileSync('.test-output/treasure-shop-entry.ts',"export {GET,POST} from '../app/api/club/route';export {load,save,committed} from '../lib/store';export {emptyState} from '../lib/domain/types';export {treasureBalance,treasureProduct,treasureRedeem,treasureOrder} from '../lib/domain/treasure-shop';");
await build({entryPoints:['.test-output/treasure-shop-entry.ts'],bundle:true,platform:'node',format:'esm',outfile:'.test-output/treasure-shop-api.mjs',plugins:[{name:'isolated-shop-auth',setup(b){
 b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'shop-test'}));
 b.onResolve({filter:/(?:^|\/)auth$/},()=>({path:'auth',namespace:'shop-test'}));
 b.onLoad({filter:/.*/,namespace:'shop-test'},a=>({loader:'js',contents:a.path==='env'?'export const env=globalThis.__treasureShopTest.env;':'export const getAppUser=async()=>globalThis.__treasureShopTest.identity.getStore()??null;export const passwordEnabled=async()=>true;'}));
}}]});
const database=sqliteD1();fixture.env.DB=database.db;
const api=await import(pathToFileURL(resolve('.test-output/treasure-shop-api.mjs')).href);
const origin='https://club.example';
const identity=id=>id?{userId:id,method:'password',displayName:'Fictional '+id}:null;
const post=async(actor,action,payload,{requestId=crypto.randomUUID(),revision,headers={}}={})=>{
 const current=revision??(await api.load()).revision;
 return fixture.identity.run(identity(actor),()=>api.POST(new Request(origin+'/api/club',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},body:JSON.stringify({action,payload,requestId,actor:actor??undefined,revision:current})})));
};
const get=async(actor,query='')=>fixture.identity.run(identity(actor),()=>api.GET(new Request(origin+'/api/club'+query)));
const view=async(actor,query='')=>{const r=await get(actor,query);assert.equal(r.status,200);return r.json()};
const succeed=async(actor,action,payload,options)=>{const r=await post(actor,action,payload,options);assert.equal(r.status,200,JSON.stringify(await r.json()));return api.load()};
const rejectUnchanged=async(actor,action,payload,status=400,options)=>{
 const before=await api.load(),r=await post(actor,action,payload,options);
 assert.equal(r.status,status,JSON.stringify(await r.json()));assert.deepEqual(await api.load(),before,'rejected action must not persist any partial changes');
};
const productInput={name:'Fictional badminton gift',description:"A useful gift '); DROP TABLE players; --",price:7,stock:12,kind:'physical',active:true};
const editProduct=async(id,changes)=>{
 const state=await api.load(),product=state.treasureProducts.find(p=>p.id===id);assert.ok(product);
 return succeed('owner','treasureProduct',{...productInput,...changes,id,expectedVersion:product.version??0});
};
try{
 const s=api.emptyState();
 Object.assign(s.settings,{initialized:true,ownerAccountId:'owner',progressionVersion:'weekly-v2',realmVersion:'elo-v1',rankingVersion:'signed-v1',scoringPolicy:'all-ranked-v1',rankedEventsVersion:'admins-v1',strengthVersion:'realm-elo-v2'});
 s.accounts=['owner','admin','member','other','disabled'].map((id,i)=>({id,email:'',playerId:'p'+i,role:i<2?'admin':'member'}));
 s.players=s.accounts.map(a=>({id:a.playerId,name:'Fictional '+a.id,ownerId:a.id,initialRating:1000,rating:1000,ratedGames:0,enabled:a.id!=='disabled',ratingReason:''}));
 s.players.push({id:'p5',name:'Fictional guest',ownerId:'member',guestEventId:'fictional-event',initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''});
 await seedAccountNoticeFixture(s);await api.save(s,'seed',api.emptyState());
 await rejectUnchanged(null,'treasureProduct',productInput,401);
 await rejectUnchanged('owner','treasureProduct',productInput,403,{headers:{Origin:'https://attacker.invalid'}});
 for(const actor of ['member','admin']){
  await rejectUnchanged(actor,'treasureProduct',productInput,403);
  await rejectUnchanged(actor,'treasureGrant',{playerId:'p2',amount:30,reason:'Fictional grant'},403);
  await rejectUnchanged(actor,'treasureProduct',{...productInput,isOwner:true,actor:'owner'});
 }
 for(const price of [0,-1,0.5,Number.MAX_SAFE_INTEGER,1e100])await rejectUnchanged('owner','treasureProduct',{...productInput,price});
 for(const stock of [-1,0.5,Number.MAX_SAFE_INTEGER,1e100])await rejectUnchanged('owner','treasureProduct',{...productInput,stock});
 await rejectUnchanged('owner','treasureProduct',{...productInput,name:' '});
 await rejectUnchanged('owner','treasureProduct',{...productInput,kind:'forged'});
 await rejectUnchanged('owner','treasureProduct',{...productInput,expectedVersion:0});
 const createId=crypto.randomUUID();let state=await succeed('owner','treasureProduct',productInput,{requestId:createId});
 const gift=state.treasureProducts.find(p=>p.name===productInput.name);assert.ok(gift);assert.equal(gift.description,productInput.description);assert.equal(state.players.length,6);
 await succeed('owner','treasureProduct',productInput,{requestId:createId,revision:s.revision});assert.equal((await api.load()).treasureProducts.length,1);
 for(const amount of [0,0.5,Number.MAX_SAFE_INTEGER,1e100])await rejectUnchanged('owner','treasureGrant',{playerId:'p2',amount,reason:'Fictional grant'});
 await rejectUnchanged('owner','treasureGrant',{playerId:'p2',amount:-1,reason:'No overdraft'});
 for(const playerId of ['missing','p4','p5'])await rejectUnchanged('owner','treasureGrant',{playerId,amount:10,reason:'Invalid recipient'});
 const grantKey=crypto.randomUUID();state=await succeed('owner','treasureGrant',{playerId:'p2',amount:100,reason:'Fictional participation reward',requestId:crypto.randomUUID()},{requestId:grantKey});
 await succeed('owner','treasureGrant',{playerId:'p2',amount:100,reason:'Fictional participation reward'},{requestId:grantKey});
 assert.equal(api.treasureBalance(await api.load(),'p2'),100);assert.equal(state.treasureLedger.length,1);assert.equal(state.treasureLedger[0].actor,'owner');assert.equal(state.treasureLedger[0].requestId,grantKey);
 state=await succeed('owner','treasureGrant',{playerId:'p3',amount:40,reason:'Fictional reward'});
 await rejectUnchanged('disabled','treasureRedeem',{productId:gift.id,expectedPrice:7});
 await rejectUnchanged('guest','treasureRedeem',{productId:gift.id,expectedPrice:7},403);
 await rejectUnchanged('other','treasureRedeem',{productId:'missing',expectedPrice:7});
 for(const quantity of [0,-1,0.5,100,Number.MAX_SAFE_INTEGER])await rejectUnchanged('member','treasureRedeem',{productId:gift.id,quantity,expectedPrice:7});
 // Browser-supplied player, price, balance and status cannot control an exchange.
 for(const forged of [{playerId:'p3'},{price:0},{total:0},{balance:9999},{status:'fulfilled'}])await rejectUnchanged('member','treasureRedeem',{productId:gift.id,expectedPrice:7,...forged});
 await rejectUnchanged('member','treasureRedeem',{productId:gift.id});
 await rejectUnchanged('member','treasureRedeem',{productId:gift.id,expectedPrice:8},409);
 const redeemKey=crypto.randomUUID();state=await succeed('member','treasureRedeem',{productId:gift.id,quantity:2,expectedPrice:7},{requestId:redeemKey});
 const order=state.treasureOrders.find(o=>o.requestId===redeemKey);assert.ok(order);assert.equal(order.playerId,'p2');assert.equal(order.price,7);assert.equal(order.quantity,2);assert.equal(order.total,14);assert.equal(order.status,'pending');
 assert.equal(api.treasureBalance(state,'p2'),86);assert.equal(api.treasureBalance(state,'p3'),40);assert.equal(state.treasureProducts.find(p=>p.id===gift.id).stock,10);
 const once=structuredClone(state);await succeed('member','treasureRedeem',{productId:gift.id,quantity:2,expectedPrice:7},{requestId:redeemKey,revision:s.revision});assert.deepEqual(await api.load(),once);
 assert.equal(await api.committed('member:'+redeemKey),true);
 // A dialog opened before an exchange must not restore its stale stock after background polling.
 assert.ok(state.treasureProducts.find(p=>p.id===gift.id).version>gift.version);
 await rejectUnchanged('owner','treasureProduct',{...productInput,id:gift.id,description:'Edited from an old dialog',expectedVersion:gift.version},409);
 await rejectUnchanged('owner','treasureProduct',{...productInput,id:gift.id});
 for(const expectedVersion of [-1,0.5,Number.MAX_SAFE_INTEGER+1])await rejectUnchanged('owner','treasureProduct',{...productInput,id:gift.id,expectedVersion});
 // Products may change; the receipt and refund retain the original unit price and quantity.
 state=await editProduct(gift.id,{name:'Renamed gift',price:50,stock:10});
 assert.equal(state.treasureProducts.find(p=>p.id===gift.id).expectedVersion,undefined,'Editor version token is input metadata, not persisted product content');
 assert.equal(state.treasureOrders[0].productName,productInput.name);assert.equal(state.treasureOrders[0].price,7);assert.equal(state.treasureOrders[0].total,14);
 for(const actor of ['member','other','admin'])await rejectUnchanged(actor,'treasureOrder',{id:order.id,status:'fulfilled'},403);
 await rejectUnchanged('admin','treasureOrder',{id:order.id,status:'fulfilled',isOwner:true});
 await rejectUnchanged('owner','treasureOrder',{id:order.id,status:'forged'});
 const me=await view('member','?playerId=p3'),other=await view('other'),admin=await view('admin'),owner=await view('owner');
 assert.equal(me.treasureShop.balance,86);assert.ok(me.treasureShop.orders.every(o=>o.playerId==='p2'));assert.ok(me.treasureShop.ledger.every(l=>l.playerId==='p2'));
 assert.ok(other.treasureShop.orders.every(o=>o.playerId==='p3'));assert.ok(other.treasureShop.ledger.every(l=>l.playerId==='p3'));
 for(const visible of [me,other,admin]){assert.deepEqual(visible.treasureShop.wallets,[]);assert.equal(visible.treasureProducts,undefined);assert.equal(visible.treasureLedger,undefined);assert.equal(visible.treasureOrders,undefined)}
 for(const o of me.treasureShop.orders)for(const field of ['accountId','requestId','handledBy'])assert.equal(o[field],undefined);
 for(const l of me.treasureShop.ledger)for(const field of ['actor','requestId'])assert.equal(l[field],undefined);
 assert.ok(owner.treasureShop.wallets.some(w=>w.playerId==='p2'&&w.balance===86));assert.ok(owner.treasureShop.orders.some(o=>o.id===order.id));
 assert.equal((await get('member','?export=1')).status,403);
 const adminExport=await view('admin','?export=1');assert.ok(adminExport.treasureLedger.every(l=>l.playerId==='p1'));assert.ok(adminExport.treasureOrders.every(o=>o.playerId==='p1'));assert.ok(adminExport.audits.every(a=>!a.action.startsWith('treasure')||a.changes?.playerId==='p1'));
 state=await editProduct(gift.id,{price:50,stock:10,active:false});
 await rejectUnchanged('member','treasureRedeem',{productId:gift.id,expectedPrice:7});
 const cancelKey=crypto.randomUUID();state=await succeed('owner','treasureOrder',{id:order.id,status:'cancelled'},{requestId:cancelKey});
 assert.equal(api.treasureBalance(state,'p2'),100);assert.equal(state.treasureProducts.find(p=>p.id===gift.id).stock,12);assert.equal(state.treasureOrders.find(o=>o.id===order.id).status,'cancelled');
 const cancelled=structuredClone(state);await succeed('owner','treasureOrder',{id:order.id,status:'cancelled'},{requestId:cancelKey});assert.deepEqual(await api.load(),cancelled);
 state=await succeed('owner','treasureOrder',{id:order.id,status:'cancelled'});for(const collection of ['treasureOrders','treasureLedger','treasureProducts','audits'])assert.deepEqual(state[collection],cancelled[collection],'fresh request ID cannot refund twice');
 await rejectUnchanged('owner','treasureOrder',{id:order.id,status:'fulfilled'});
 // Competing requests share one revision: exactly one commits, the other is safe to refresh/retry.
 state=await editProduct(gift.id,{price:60,stock:1});
 const keys=[crypto.randomUUID(),crypto.randomUUID()],revision=state.revision;
 const competing=await Promise.all(keys.map(requestId=>post('member','treasureRedeem',{productId:gift.id,expectedPrice:60},{requestId,revision})));
 assert.equal(competing.filter(r=>r.status===200).length,1);assert.ok(competing.every(r=>[200,400,409].includes(r.status)));
 state=await api.load();assert.equal(api.treasureBalance(state,'p2'),40);assert.equal(state.treasureProducts.find(p=>p.id===gift.id).stock,0);assert.equal(state.treasureOrders.filter(o=>o.status==='pending').length,1);
 const lost=keys[competing.findIndex(r=>r.status!==200)];await rejectUnchanged('member','treasureRedeem',{productId:gift.id,expectedPrice:60},400,{requestId:lost});
 // Sufficient stock with insufficient funds exercises a separate rollback path.
 state=await editProduct(gift.id,{price:60,stock:10});
 await rejectUnchanged('member','treasureRedeem',{productId:gift.id,expectedPrice:60});
 const pending=state.treasureOrders.find(o=>o.status==='pending');state=await succeed('owner','treasureOrder',{id:pending.id,status:'fulfilled'});
 await rejectUnchanged('owner','treasureOrder',{id:pending.id,status:'cancelled'});
 // A database failure after the optimistic revision gate must roll back stock, wallet and order together.
 state=await editProduct(gift.id,{price:10,stock:10});
 database.injectFailure(query=>/INSERT INTO treasureOrders\(/i.test(query));
 await rejectUnchanged('member','treasureRedeem',{productId:gift.id,expectedPrice:10},503);
 database.injectFailure(null);
 // Grants may deduct currency but never alter sporting points, rating or achievements.
 const sports=state.players.map(p=>({id:p.id,rating:p.rating,ratedGames:p.ratedGames}));
 state=await succeed('owner','treasureGrant',{playerId:'p2',amount:-5,reason:'Fictional correction'});
 assert.equal(api.treasureBalance(state,'p2'),35);assert.deepEqual(state.players.map(p=>({id:p.id,rating:p.rating,ratedGames:p.ratedGames})),sports);
 await rejectUnchanged('owner','treasureGrant',{playerId:'p2',amount:-36,reason:'Overdraft'});
 assert.equal(database.sql.prepare('SELECT COUNT(*) AS count FROM treasureOrders').get().count,2);
 // Two different members compete for the last item while both can afford it.
 state=await succeed('owner','treasureProduct',{...productInput,name:'Fictional limited gift',price:10,stock:1,kind:'digital'});
 const limited=state.treasureProducts.find(p=>p.name==='Fictional limited gift'),stockKeys=[crypto.randomUUID(),crypto.randomUUID()],stockRevision=state.revision;
 const beforeWallets=api.treasureBalance(state,'p2')+api.treasureBalance(state,'p3');
 const stockRace=await Promise.all(['member','other'].map((actor,i)=>post(actor,'treasureRedeem',{productId:limited.id,expectedPrice:10},{requestId:stockKeys[i],revision:stockRevision})));
 assert.equal(stockRace.filter(r=>r.status===200).length,1);assert.ok(stockRace.every(r=>[200,400,409].includes(r.status)));
 state=await api.load();assert.equal(state.treasureProducts.find(p=>p.id===limited.id).stock,0);assert.equal(api.treasureBalance(state,'p2')+api.treasureBalance(state,'p3'),beforeWallets-10);assert.equal(state.treasureOrders.filter(o=>o.productId===limited.id).length,1);
 assert.equal(state.treasureOrders.find(o=>o.productId===limited.id).kind,'digital');
 // With plentiful inventory, parallel exchanges cannot spend one member's wallet twice.
 state=await succeed('owner','treasureGrant',{playerId:'p2',amount:100-api.treasureBalance(state,'p2'),reason:'Fictional race setup'});
 state=await succeed('owner','treasureProduct',{...productInput,name:'Fictional wallet-race gift',price:60,stock:10});
 const walletProduct=state.treasureProducts.find(p=>p.name==='Fictional wallet-race gift'),walletRevision=state.revision;
 const walletRace=await Promise.all([0,1].map(()=>post('member','treasureRedeem',{productId:walletProduct.id,expectedPrice:60},{revision:walletRevision})));
 assert.equal(walletRace.filter(r=>r.status===200).length,1);assert.ok(walletRace.every(r=>[200,400,409].includes(r.status)));
 state=await api.load();assert.equal(api.treasureBalance(state,'p2'),40);assert.equal(state.treasureProducts.find(p=>p.id===walletProduct.id).stock,9);assert.equal(state.treasureOrders.filter(o=>o.productId===walletProduct.id).length,1);
 // Reusing an exchange ID concurrently is also a single charge and a single receipt.
 const duplicateId=crypto.randomUUID();state=await succeed('owner','treasureProduct',{...productInput,name:'Fictional replay gift',price:10,stock:10});
 const replayProduct=state.treasureProducts.find(p=>p.name==='Fictional replay gift'),replayRevision=state.revision;
 const replayRace=await Promise.all([0,1].map(()=>post('member','treasureRedeem',{productId:replayProduct.id,expectedPrice:10},{requestId:duplicateId,revision:replayRevision})));
 assert.ok(replayRace.every(r=>r.status===200));state=await api.load();assert.equal(api.treasureBalance(state,'p2'),30);assert.equal(state.treasureProducts.find(p=>p.id===replayProduct.id).stock,9);assert.equal(state.treasureOrders.filter(o=>o.requestId===duplicateId).length,1);
 // Timestamps can collide: an integer version must distinguish every inventory change within one millisecond.
 const sameMillisecond=Date.now(),domain=structuredClone(state),ownerAccount=domain.accounts.find(a=>a.id==='owner'),memberAccount=domain.accounts.find(a=>a.id==='member');
 const versioned=api.treasureProduct(domain,ownerAccount,{...productInput,name:'Fictional same-millisecond gift'},sameMillisecond),initialVersion=versioned.version;
 api.treasureProduct(domain,ownerAccount,{...productInput,id:versioned.id,expectedVersion:initialVersion,name:'Same-millisecond edit'},sameMillisecond);
 assert.equal(versioned.version,initialVersion+1);assert.equal(versioned.updated,sameMillisecond);
 const editedVersion=versioned.version;
 const versionedOrder=api.treasureRedeem(domain,memberAccount,{productId:versioned.id,expectedPrice:7,quantity:1,requestId:crypto.randomUUID()},sameMillisecond);
 assert.equal(versioned.version,editedVersion+1);assert.equal(versioned.updated,sameMillisecond);
 const domainBefore=structuredClone(domain);assert.throws(()=>api.treasureProduct(domain,ownerAccount,{...productInput,id:versioned.id,expectedVersion:editedVersion},sameMillisecond),/409/);assert.deepEqual(domain,domainBefore);
 const boughtVersion=versioned.version;api.treasureOrder(domain,ownerAccount,{id:versionedOrder.id,status:'cancelled'},sameMillisecond);assert.equal(versioned.version,boughtVersion+1);assert.equal(versioned.updated,sameMillisecond);
 console.log('PASS treasure shop API: true-owner permissions, bound SQL, persisted independent wallet, validation, immutable receipts, private projection, replay, racing purchases, stock/funds guards, cancellation/refund and transactional rollback');
}finally{database.injectFailure(null);database.close();delete globalThis.__treasureShopTest}
