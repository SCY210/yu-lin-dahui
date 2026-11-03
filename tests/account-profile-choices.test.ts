import {test} from 'node:test';
import assert from 'node:assert/strict';
import {accountProfileChoices} from '../lib/client/recorded-friends';

test('account creation lists the same friends as 临时来宾, once each, besides member profiles left without an account',()=>{
 const host={guest:true,guestHost:'Fictional host',guestHostId:'p1'};
 const players=[
  {id:'p1',name:'Fictional host'},
  {id:'old',name:'Fictional former member'},
  // Older friend records without an activity: three "aq" records of one friend, as in the reported screenshot.
  ...['aq-1','aq-2','aq-3'].map(id=>({id,name:'aq',...host})),
  // Today's friend records: one per activity.
  {id:'bo-1',name:'bo',guestEventId:'e1',...host},{id:'bo-2',name:'bo',guestEventId:'e2',...host},
  {id:'zz',name:'zz',guestEventId:'e1',guestHidden:true,...host},
 ];
 const data={players,accounts:[{playerId:'p1'}],events:[{id:'e1',start:1},{id:'e2',start:2}],
  registrations:[{eventId:'e1',playerId:'aq-1'},{eventId:'e2',playerId:'aq-3'},{eventId:'e1',playerId:'bo-1'},{eventId:'e2',playerId:'bo-2'}]};
 const {available,friends}=accountProfileChoices(data);
 assert.deepEqual(available.map(p=>p.id),['old'],'only a member profile keeps its history; friends are not profiles');
 assert.deepEqual(friends.map(f=>[f.name,f.host,f.activities]),[['aq','Fictional host',2],['bo','Fictional host',2]],'one line per friend, removed friends left out');
 assert.equal(friends.find(f=>f.name==='bo')!.id,'bo-2','the latest record carries the friend');
});
