import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apply} from '../lib/domain/commands';
import {liveAppearances} from '../lib/domain/live-play';
import {emptyState,type Event,type Match} from '../lib/domain/types';
const now=Date.parse('2030-10-10T15:00:00Z');
function fixture(singles=false){
 const s=emptyState();s.settings.initialized=true;s.settings.ownerAccountId='admin';
 s.accounts=Array.from({length:8},(_,i)=>({id:i?'member'+i:'admin',playerId:'p'+i,role:i?'member' as const:'admin' as const,email:''}));
 s.players=s.accounts.map(a=>({id:a.playerId,name:a.playerId,ownerId:a.id,enabled:true,initialRating:1000,rating:1000,ratedGames:0,ratingReason:''}));
 const e:Event={id:'e',creatorId:'member1',title:'Fictional lineup',start:now-3600000,end:now+3600000,venue:'Fixture Venue',address:'',capacity:8,signupDeadline:now+3600000,cancelDeadline:now-86400000,note:'',status:'open',matchFormat:singles?'singles':'doubles',attendanceMode:'automatic',courtMode:'equal',ballMode:'equal'};s.events=[e];s.bookings=[{id:'c',eventId:e.id,name:'Court',start:e.start,end:e.end,pricing:'total',cents:1000}];
 s.registrations=s.players.map((p,i)=>({id:'r'+i,eventId:e.id,playerId:p.id,status:'confirmed',sequence:i,arrival:e.start,departure:e.end,note:'',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''}}));
 return {s,e};
}
const active=(s:ReturnType<typeof emptyState>)=>s.matches.find(m=>m.status==='playing')!;
const edit=(m:Match,a=['p4','p5'],b=['p2','p3'])=>({matchId:m.id,a,b,expectedA:[...m.a],expectedB:[...m.b]});
test('creator can replace the current lineup, retaining the game and round; only corrected players receive the result',async()=>{
 const {s,e}=fixture();await apply(s,s.accounts[0],'liveStart',{eventId:e.id},now);const m=active(s),before=structuredClone(m),count=s.matches.length;
 await apply(s,s.accounts[1],'liveLineup',edit(m),now+1000);
 assert.deepEqual(m.a,['p4','p5']);assert.deepEqual(m.b,['p2','p3']);assert.equal(m.id,before.id);assert.equal(m.start,before.start);assert.equal(m.courtId,before.courtId);assert.equal(s.matches.length,count);assert.equal(m.status,'playing');assert.equal(liveAppearances(s,e.id,'p0'),0);assert.equal(liveAppearances(s,e.id,'p4'),1);
 assert.ok(s.rounds[0].rest.includes('p0'));assert.ok(!s.rounds[0].rest.includes('p4'));assert.deepEqual((s.audits.at(-1)!.changes as {before:unknown}).before,{a:before.a,b:before.b});
 await apply(s,s.accounts[0],'score',{matchId:m.id,a:21,b:19},now+60000);assert.equal(m.status,'complete');assert.deepEqual(m.a,['p4','p5']);assert.equal(s.matches.length,count+1);
});
test('ordinary members and spoofed event IDs do not grant lineup authority; rejected writes change nothing',async()=>{
 const {s,e}=fixture();await apply(s,s.accounts[0],'liveStart',{eventId:e.id},now);const before=structuredClone(s);
 await assert.rejects(()=>apply(s,s.accounts[2],'liveLineup',{...edit(active(s)),eventId:'my-event',isOwner:true},now+1),/403/);assert.deepEqual(s,before);
});
test('duplicates, another active court, waitlist, disabled, future arrivals and requested rest are rejected atomically',async()=>{
 for(const invalid of ['duplicate','busy','waitlist','disabled','future','rest','venue']){
  const {s,e}=fixture();await apply(s,s.accounts[0],'liveStart',{eventId:e.id},now);const m=active(s),p=edit(m);
  if(invalid==='duplicate')p.a=['p4','p4'];
  if(invalid==='busy')s.matches.push({...structuredClone(m),id:'other-game',eventId:'other-event',a:['p4','x'],b:['y','z']});
  if(invalid==='waitlist')s.registrations[4].status='waitlist';
  if(invalid==='disabled')s.players[4].enabled=false;
  if(invalid==='future')s.registrations[4].arrival=now+60000;
  if(invalid==='rest')e.livePlay!.rest.push({playerId:'p4',venue:e.venue,after:now});
  if(invalid==='venue')s.bookings[0].venue='Different Venue';
  const before=structuredClone(s);await assert.rejects(()=>apply(s,s.accounts[0],'liveLineup',p,now+1000),/同一球友|可上场/);assert.deepEqual(s,before,invalid);
 }
});
test('a stale form, completed match, wrong team size and ended activity cannot change participants',async()=>{
 const {s,e}=fixture();await apply(s,s.accounts[0],'liveStart',{eventId:e.id},now);const m=active(s),stale=edit(m);
 await apply(s,s.accounts[0],'liveLineup',stale,now+1);const before=structuredClone(s);
 await assert.rejects(()=>apply(s,s.accounts[0],'liveLineup',stale,now+2),/409/);assert.deepEqual(s,before);
 await assert.rejects(()=>apply(s,s.accounts[0],'liveLineup',edit(m,['p4'],['p2']),now+2),/双打/);
 e.status='ended';await assert.rejects(()=>apply(s,s.accounts[0],'liveLineup',edit(m),now+2),/活动已结束/);e.status='open';
 m.status='complete';await assert.rejects(()=>apply(s,s.accounts[0],'liveLineup',edit(m),now+2),/当前对局/);
});
test('singles uses one player per side; explicit manual teams do not rewrite future fixed-partner settings',async()=>{
 const {s,e}=fixture(true);await apply(s,s.accounts[0],'liveStart',{eventId:e.id},now);const m=active(s);await apply(s,s.accounts[0],'liveLineup',edit(m,['p2'],['p3']),now+1);assert.deepEqual([m.a,m.b],[['p2'],['p3']]);
 const f=fixture();f.e.pointsChoice={votes:[],votingOpen:false,selectedMode:'fixed',teams:[['p0','p1'],['p2','p3'],['p4','p5'],['p6','p7']]};await apply(f.s,f.s.accounts[0],'liveStart',{eventId:f.e.id},now);const teams=structuredClone(f.e.pointsChoice.teams);await apply(f.s,f.s.accounts[0],'liveLineup',edit(active(f.s),['p0','p4'],['p2','p5']),now+1);assert.deepEqual(f.e.pointsChoice.teams,teams);
});
