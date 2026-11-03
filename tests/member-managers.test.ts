import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canManageAccount,canManageMembers} from '../lib/domain/member-managers';
import {duplicateGuestSignup} from '../lib/domain/guest-names';
import {emptyState,type Account} from '../lib/domain/types';

test('administrators and testers manage members; a tester only ordinary members, never the owner, an administrator or a tester',()=>{
 const s=emptyState();s.settings.ownerAccountId='owner';
 const owner:Account={id:'owner',email:'',role:'admin',playerId:'p0'},admin:Account={id:'admin',email:'',role:'admin',playerId:'p1'};
 const tester:Account={id:'tester',email:'',role:'member',playerId:'p2',simulationTester:true},other:Account={...tester,id:'tester2',playerId:'p3'};
 const member:Account={id:'member',email:'',role:'member',playerId:'p4'};
 s.accounts=[owner,admin,tester,other,member];
 assert.deepEqual([owner,admin,tester,member].map(canManageMembers),[true,true,true,false]);
 const may=(a:Account)=>s.accounts.filter(t=>canManageAccount(s,a,t)).map(t=>t.id);
 assert.deepEqual(may(owner),['owner','admin','tester','tester2','member']);
 assert.deepEqual(may(admin),['admin','tester','tester2','member'],'the owner’s account is the owner’s alone');
 assert.deepEqual(may(tester),['member']);
});

test('a duplicate friend signup is any active one after the first under the same loose nickname',()=>{
 const players=[{id:'a',name:'aq',guestEventId:'e'},{id:'b',name:'AQ 2',guestEventId:'e'},{id:'c',name:'bo',guestEventId:'e'},{id:'d',name:'aq',guestEventId:'other'},{id:'m',name:'aq'}];
 const reg=(playerId:string,sequence:number,status='confirmed',eventId='e')=>({eventId,playerId,sequence,status});
 const s={players,registrations:[reg('a',1),reg('b',2),reg('c',3),reg('d',1,'confirmed','other'),reg('m',4)]};
 assert.deepEqual(['a','b','c','d','m'].map(id=>duplicateGuestSignup(s,'e',id)),[false,true,false,false,false],'the first is kept; members and other activities are never duplicates');
 s.registrations[0].status='cancelled';
 assert.equal(duplicateGuestSignup(s,'e','b'),false,'once the other is cancelled, the remaining signup is not a duplicate');
});
