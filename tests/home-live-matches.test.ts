import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,type Event,type Match} from '../lib/domain/types';
import {homeLiveMatches} from '../lib/client/home-live-matches';
const now=Date.parse('2030-10-08T12:00:00Z');
function fixture(){
 const s=emptyState(),event:Event={id:'event',title:'Fixture doubles',matchFormat:'doubles',creatorId:'host',start:now-60000,end:now+60000,venue:'Fixture venue',address:'',capacity:8,signupDeadline:now,cancelDeadline:now,note:'',status:'open',courtMode:'equal',ballMode:'equal'};
 s.events.push(event);s.bookings.push({id:'court',eventId:event.id,name:'Court 1',start:event.start,end:event.end,pricing:'total',cents:690});
 s.rounds.push({id:'round',eventId:event.id,start:event.start,duration:0,status:'playing',eligible:['a','b','c','d'],rest:[],seed:1,live:true,liveSequence:2});
 const match:Match={id:'match',eventId:event.id,roundId:'round',courtId:'court',a:['a','b'],b:['c','d'],status:'playing',start:now-1000,end:null,scoreA:null,scoreB:null,monthly:true,elo:true,locked:false,enteredBy:null,games:[]};s.matches.push(match);return s;
}
test('only actual playing games within a currently visible activity appear, including both formats',()=>{
 const s=fixture();assert.equal(homeLiveMatches(s,now).length,1);s.events[0].matchFormat='singles';s.matches[0].a=['a'];s.matches[0].b=['b'];assert.equal(homeLiveMatches(s,now)[0].match.a.length,1);
 for(const status of ['draft','published','complete','cancelled','forfeit'] as const){s.matches[0].status=status;assert.deepEqual(homeLiveMatches(s,now),[])}
});
test('future, ended, cancelled, draft, deleted and orphan activity data never shows stale live cards',()=>{
 for(const kind of ['future-event','ended-clock','ended-status','cancelled','draft','deleted','missing-event','future-game','no-start','bad-start','missing-round','finished-round','foreign-round'] as const){
  const s=fixture();if(kind==='future-event')s.events[0].start=now+1;if(kind==='ended-clock')s.events[0].end=now;
  if(kind==='ended-status')s.events[0].status='ended';if(kind==='cancelled')s.events[0].status='cancelled';if(kind==='draft')s.events[0].status='draft';if(kind==='deleted')s.events[0].deletedAt=0;if(kind==='missing-event')s.events=[];
  if(kind==='future-game')s.matches[0].start=now+1;if(kind==='no-start')s.matches[0].start=null;if(kind==='bad-start')s.matches[0].start=NaN;
  if(kind==='missing-round')s.rounds=[];if(kind==='finished-round')s.rounds[0].status='complete';if(kind==='foreign-round')s.rounds[0].eventId='foreign';
  assert.deepEqual(homeLiveMatches(s,now),[],kind);
 }
});
test('all simultaneous courts remain visible, numeric court ordering is stable and selection never mutates data',()=>{
 const s=fixture();s.bookings[0].name='Court 10';s.bookings.push({...s.bookings[0],id:'court2',name:'Court 2'});s.matches.push({...s.matches[0],id:'match2',courtId:'court2',a:['e'],b:['f']});const before=structuredClone(s);
 assert.deepEqual(homeLiveMatches(s,now).map(row=>row.match.id),['match2','match']);assert.deepEqual(s,before);
 assert.equal(homeLiveMatches(s,now+60000).length,0);s.bookings=[];assert.equal(homeLiveMatches(s,now)[0].court,undefined);
});
