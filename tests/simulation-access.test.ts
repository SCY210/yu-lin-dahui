import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canUseSimulation} from '../lib/domain/simulation-access';
import {apply} from '../lib/domain/commands';
import {emptyState,type Account} from '../lib/domain/types';
import {projectClubState} from '../lib/club-view';

function fixture(){
 const s=emptyState();s.settings.initialized=true;s.settings.ownerAccountId='owner';
 s.accounts=['owner','admin','tester','member'].map(id=>({id,playerId:'p-'+id,email:'',role:id==='owner'||id==='admin'?'admin':'member'}));
 s.players=s.accounts.map(a=>({id:a.playerId,name:'Fictional '+a.id,ownerId:a.id,enabled:true,initialRating:1000,rating:1000,ratedGames:0,ratingReason:''}));
 return {s,owner:s.accounts[0],admin:s.accounts[1],tester:s.accounts[2],member:s.accounts[3]};
}
const grant={accountId:'tester',enabled:true,reason:'Fictional sandbox permission'};
test('simulation capability accepts only an admin role or an explicit stored boolean grant',()=>{
 assert.equal(canUseSimulation(null),false);assert.equal(canUseSimulation({role:'member'}),false);assert.equal(canUseSimulation({role:'admin'}),true);
 assert.equal(canUseSimulation({role:'member',simulationTester:true}),true);
 for(const value of [false,undefined,'true',1])assert.equal(canUseSimulation({role:'member',simulationTester:value as boolean}),false);
});
test('only the owner grants and revokes tester access without changing the member role',async()=>{
 const {s,owner,admin,tester,member}=fixture(),before=structuredClone(s);
 for(const actor of [admin,tester,member]){await assert.rejects(()=>apply(s,actor,'simulationAccess',grant,Date.now()),/403/);assert.deepEqual(s,before)}
 await apply(s,owner,'simulationAccess',grant,Date.now());assert.equal(tester.role,'member');assert.equal(tester.simulationTester,true);assert.equal(canUseSimulation(tester),true);
 assert.equal(s.audits.at(-1)?.actor,'owner');assert.equal(s.audits.at(-1)?.action,'simulationAccess');
 await apply(s,owner,'simulationAccess',{...grant,enabled:false},Date.now());assert.equal(tester.role,'member');assert.equal(canUseSimulation(tester),false);
 await assert.rejects(()=>apply(s,owner,'simulationAccess',{...grant,accountId:'owner'},Date.now()),/群主/);
 await assert.rejects(()=>apply(s,owner,'simulationAccess',{...grant,accountId:'admin'},Date.now()),/普通成员/);
});
test('a tester cannot change real roles, rules, points, ratings or their own tester permission',async()=>{
 const {s,owner,tester}=fixture();await apply(s,owner,'simulationAccess',grant,Date.now());
 for(const action of ['role','settings','grantPoints','rating','blockedWords','historyRules','simulationAccess']){
  const before=structuredClone(s);await assert.rejects(()=>apply(s,tester,action,{},Date.now()),/403/);assert.deepEqual(s,before,action);
 }
});
test('tester projections preserve normal-member data visibility and role permissions',()=>{
 const {s,tester,member}=fixture();tester.simulationTester=true;
 const view=(a:Account)=>projectClubState(s,a,'2026-10',2026);
 const testView=view(tester),ordinary=view(member);assert.equal(testView.me.role,'member');assert.equal(testView.me.isOwner,false);
 assert.deepEqual(testView.permissions,{canManageRoles:false,canManageBlockedWords:false,canUseSimulation:true});
 assert.equal(ordinary.permissions.canUseSimulation,false);assert.deepEqual(testView.accounts,[]);assert.deepEqual(testView.audits,[]);assert.ok(testView.players.every(p=>p.rating===null));
});
