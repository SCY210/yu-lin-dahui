import {test} from 'node:test';
import assert from 'node:assert/strict';
import {balanceCost,compareBalance,LIVE_PARTNER_PENALTY_LIMIT} from '../lib/domain/match-balance';
import {matchHistory} from '../lib/domain/match-history';
import {fillLiveCourts} from '../lib/domain/live-play';
import {createSimulation} from '../lib/admin-simulation';

test('partner repetition can outweigh a modest gap but cannot buy an arbitrarily uneven game',()=>{
 const repeated=balanceCost([10],900,0,0,0,40),changed=balanceCost([60],100,0,0,0,4);
 assert.ok(compareBalance(changed,repeated)<0);
 assert.ok(compareBalance(balanceCost([300],0,0,0,0,0),repeated)>0);
 assert.equal(balanceCost([0],0,0,0,0,100000).partnerPenalty,LIVE_PARTNER_PENALTY_LIMIT);
 assert.ok(compareBalance(balanceCost([8],0,1),balanceCost([150],100,0,0,0,40))>0,'existing gender safeguards retain priority');
 assert.equal(balanceCost([8],710).partnerPenalty,0,'planned/fixed/singles callers do not opt into the live rotating preference');
});

test('partner history counts the pair across different opponents and forgets its consecutive bonus after another partner',()=>{
 const history=matchHistory({matches:[],rounds:[]},'event',true);
 history.add({a:['a','b'],b:['x','y']});
 assert.equal(history.rematches(['a','b'],['c','d']),0);
 assert.equal(history.partnerPenalty(['a','b'],['c','d']),28);
 history.add({a:['a','c'],b:['b','d']});
 assert.equal(history.partnerPenalty(['a','b'],['x','z']),4,'the old pair keeps frequency, not the last-partner bonus');
 assert.equal(history.partnerPenalty(['a'],['b']),0);
 for(let i=0;i<100;i++)history.add({a:['a','b'],b:['x','y']});
 history.add({a:['a','c'],b:['b','d']});
 assert.equal(history.partnerPenalty(['a','b'],['x','z']),16,'old frequency is bounded separately from consecutive reuse');
 assert.ok(history.partnerPenalty(['a','c'],['x','z'])>16,'a long history never erases the last-partner preference');
});

function fixture(ratings:number[]){
 const now=Date.parse('2030-10-10T16:00:00Z'),s=createSimulation(now).state,e=s.events[0];
 s.players=s.players.slice(0,4);s.accounts=s.accounts.slice(0,4);s.registrations=s.registrations.slice(0,4);s.bookings=s.bookings.slice(0,1);
 s.players.forEach((p,i)=>p.rating=ratings[i]);
 e.livePlay={enabled:true,paused:false,preferences:[],completions:[],rest:[]};
 const ids=s.players.map(p=>p.id);
 for(let i=0;i<4;i++)s.matches.push({id:'history-'+i,eventId:e.id,roundId:'past-'+i,courtId:'past-court',a:ids.slice(0,2),b:['absent-'+i+'a','absent-'+i+'b'],status:'complete',start:now-10000+i,end:now-9000+i,scoreA:21,scoreB:19,monthly:true,elo:true,locked:false,enteredBy:s.accounts[0].id,games:[{a:21,b:19}]});
 return {s,e,now,ids};
}
test('the real live selector changes a repeated pair against new opponents without ejecting anyone',()=>{
 // Fictional team-average gaps are 10, 70 and 60. The old selector always chose the 10-point repeat.
 const {s,e,now,ids}=fixture([1080,950,1010,1000]);
 const [m]=fillLiveCourts(s,e,now,{courtId:s.bookings[0].id});assert.ok(m);
 assert.deepEqual(new Set([...m.a,...m.b]),new Set(ids));
 assert.ok(![m.a,m.b].some(team=>ids.slice(0,2).every(id=>team.includes(id))));
 const mean=(team:string[])=>team.reduce((n,id)=>n+s.players.find(p=>p.id===id)!.rating,0)/2;
 assert.equal(Math.abs(mean(m.a)-mean(m.b)),60);
});
test('the real selector keeps skill balance for large gaps and never splits configured fixed partners',()=>{
 const balanced=fixture([1000,1000,1600,400]);
 const [m]=fillLiveCourts(balanced.s,balanced.e,balanced.now,{courtId:balanced.s.bookings[0].id});
 assert.ok([m.a,m.b].some(team=>balanced.ids.slice(0,2).every(id=>team.includes(id))),'a 600-point alternative is not chosen just to change partners');
 const fixed=fixture([1080,950,1010,1000]);fixed.e.pointsChoice={votes:[],votingOpen:false,selectedMode:'fixed',teams:[fixed.ids.slice(0,2),fixed.ids.slice(2)]};
 const [f]=fillLiveCourts(fixed.s,fixed.e,fixed.now,{courtId:fixed.s.bookings[0].id});
 assert.ok([f.a,f.b].some(team=>fixed.ids.slice(0,2).every(id=>team.includes(id))));
});
