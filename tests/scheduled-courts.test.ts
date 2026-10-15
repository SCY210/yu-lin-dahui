import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation} from './helpers/scheduling-fixture';
import {apply} from '../lib/domain/commands';
import {advanceScheduledCourts,readyScheduledMatches} from '../lib/domain/scheduled-courts';
import {startDuePointsSessions} from '../lib/domain/points-auto-start';
import {clubViewValidUntil} from '../lib/club-read-cache';
import type {Match,Round} from '../lib/domain/types';
const now=Date.parse('2030-10-10T13:00:00Z'),minute=60000;
function fixture(){
 const s=createSimulation(now).state,e=s.events[0];e.schedulingMode='planned';e.pointsSession={startedAt:now,attendance:[],waiting:[]};
 e.pointsPlan={start:now,end:now+45*minute,roundMinutes:15,seed:1,generatedAt:now-1};
 for(let n=0;n<3;n++){
  const r:Round={id:'round'+n,eventId:e.id,start:now+n*15*minute,duration:15,status:n?'published':'playing',eligible:s.players.map(p=>p.id),rest:s.players.slice(8).map(p=>p.id),seed:n+1,pointsSlot:n+1};s.rounds.push(r);
  for(let c=0;c<2;c++){const ids=s.players.slice(c*4,c*4+4).map(p=>p.id);const m:Match={id:'m'+n+c,eventId:e.id,roundId:r.id,courtId:s.bookings[c].id,a:ids.slice(0,2),b:ids.slice(2),status:n?'published':'playing',start:n?null:now,end:null,scoreA:null,scoreB:null,monthly:true,elo:true,locked:false,enteredBy:null,games:[]};s.matches.push(m)}
 }
 return s;
}
test('one scored court advances immediately; overlapping rounds complete only when all their courts finish',async()=>{
 const s=fixture(),a=s.accounts[0],m=(id:string)=>s.matches.find(x=>x.id===id)!;
 await apply(s,a,'score',{matchId:'m00',a:21,b:17},now+minute);
 assert.equal(m('m00').status,'complete');assert.equal(m('m01').status,'playing');assert.equal(m('m10').status,'playing');assert.equal(m('m10').start,now+minute);assert.equal(m('m11').status,'published');assert.deepEqual(s.rounds.map(r=>r.status),['playing','playing','published']);
 const saved=structuredClone(s);
 assert.equal(await startDuePointsSessions(s,now+minute+1,apply),false);assert.deepEqual(s,saved);
 await apply(s,a,'score',{matchId:'m10',a:21,b:18},now+2*minute);
 assert.equal(m('m20').status,'playing');assert.deepEqual(s.rounds.map(r=>r.status),['playing','playing','playing']);
 await apply(s,a,'score',{matchId:'m01',a:21,b:19},now+3*minute);
 assert.deepEqual(s.rounds.map(r=>r.status),['complete','playing','playing']);assert.equal(m('m11').start,now+3*minute);assert.equal(m('m21').status,'published');
 const next=structuredClone(s.matches.filter(m=>m.roundId!=='round0'));
 await apply(s,a,'score',{matchId:'m00',a:21,b:16},now+4*minute);
 assert.deepEqual(s.matches.filter(m=>m.roundId!=='round0'),next,'score corrections never restart the next game');
 assert.equal(new Set(s.matches.filter(m=>m.status==='playing').flatMap(m=>[...m.a,...m.b])).size,8);
});
test('published next match waits for its players on another court, then starts when they are released',async()=>{
 const s=fixture(),a=s.accounts[0];const next=s.matches.find(m=>m.id==='m10')!;next.a=[...s.matches.find(m=>m.id==='m01')!.a];
 await apply(s,a,'score',{matchId:'m00',a:21,b:17},now+minute);assert.equal(next.status,'published');
 await apply(s,a,'score',{matchId:'m01',a:21,b:17},now+2*minute);assert.equal(next.status,'playing');assert.equal(next.start,now+2*minute);
 assert.equal(s.matches.find(m=>m.id==='m11')!.status,'published','a player cannot play both courts at once');
});
test('drafts block their court queue; another physical court can progress without publishing a draft',async()=>{
 const s=fixture();s.rounds[1].status='draft';s.matches.filter(m=>m.roundId==='round1').forEach(m=>m.status='draft');
 await apply(s,s.accounts[0],'score',{matchId:'m00',a:21,b:17},now+minute);
 assert.equal(s.matches.find(m=>m.id==='m20')!.status,'published');assert.equal(s.rounds[1].status,'draft');assert.equal(readyScheduledMatches(s,s.events[0],now+40*minute).length,0);
});
test('booking aliases and players in another activity cannot double-book a court',async()=>{
 const s=fixture();s.matches[0].status='complete';s.matches[0].end=now+minute;
 const other={...s.events[0],id:'other'};s.events.push(other);s.bookings.push({...s.bookings[0],id:'other-booking',eventId:other.id});
 s.matches.push({...s.matches[0],id:'other-match',eventId:other.id,courtId:'other-booking',a:s.players.slice(8,10).map(p=>p.id),b:s.players.slice(10,12).map(p=>p.id),status:'playing',end:null});
 assert.equal(advanceScheduledCourts(s,s.events[0],now+minute),false);
});
test('late arrival releases a published court at its exact boundary, even while the prior round continues',async()=>{
 const s=fixture(),at=now+2*minute+1234,player=s.players[8].id;
 s.matches.find(m=>m.id==='m10')!.a[0]=player;s.registrations.find(r=>r.playerId===player)!.arrival=at;
 await apply(s,s.accounts[0],'score',{matchId:'m00',a:21,b:17},now+minute);
 const before=at-1;assert.equal(readyScheduledMatches(s,s.events[0],before).length,0);assert.equal(clubViewValidUntil(s,s.accounts[0],before),at);
 assert.equal(await startDuePointsSessions(s,at,apply),true);assert.equal(s.matches.find(m=>m.id==='m10')!.start,at);assert.equal(s.rounds[0].status,'playing');
});
test('future results, ended activities, absent and opted-out players do not start a next game',()=>{
 for(const kind of ['future','ended','absent','opt-out']){
  const s=fixture(),e=s.events[0];s.matches[0].status='complete';s.matches[0].end=kind==='future'?now+3*minute:now+minute;
  if(kind==='ended')e.end=now+minute;
  if(kind==='absent')e.noShowHold=[s.matches.find(m=>m.id==='m10')!.a[0]];
  if(kind==='opt-out')e.pointsSession!.attendance.push({playerId:s.matches.find(m=>m.id==='m10')!.a[0],late:true,available:false,at:now});
  const before=structuredClone(s);assert.equal(advanceScheduledCourts(s,e,now+minute),false,kind);assert.deepEqual(s,before);
 }
});
test('single courts and fixed doubles preserve published teams, flags and once-only start',async()=>{
 for(const format of ['singles','doubles'] as const){const s=fixture(),e=s.events[0];e.matchFormat=format;e.ranked=false;
  if(format==='singles')s.matches.forEach(m=>{m.a=m.a.slice(0,1);m.b=m.b.slice(0,1)});else e.pointsChoice={selectedMode:'fixed',votes:[],votingOpen:false,teams:s.matches.slice(0,2).flatMap(m=>[m.a,m.b])};
  const next=s.matches.find(m=>m.id==='m10')!,teams={a:[...next.a],b:[...next.b]};await apply(s,s.accounts[0],'score',{matchId:'m00',a:21,b:19},now+minute);
  assert.deepEqual({a:next.a,b:next.b},teams);assert.equal(next.status,'playing');assert.equal(next.monthly,false);assert.equal(next.elo,false);
  const before=structuredClone(s);assert.equal(advanceScheduledCourts(s,e,now+minute+1),false);assert.deepEqual(s,before);
 }
});

test('all unscored planned courts remain editable while recorded courts stay protected',async()=>{
 const s=fixture(),next=s.matches.find(m=>m.id==='m11')!,ids=s.players.slice(8).map(p=>p.id);next.a=ids.slice(0,2);next.b=ids.slice(2);
 await apply(s,s.accounts[0],'score',{matchId:'m00',a:21,b:17},now+minute);
 assert.equal(s.rounds[1].status,'playing');assert.equal(next.status,'published');
 await apply(s,s.accounts[0],'swap',{roundId:'round1',p1:ids[0],p2:ids[2]},now+minute);
 assert.equal(next.a[0],ids[2]);assert.equal(next.b[0],ids[0]);
 await assert.rejects(()=>apply(s,s.accounts[0],'lock',{matchId:next.id,locked:true},now+minute),/锁定功能已取消/);assert.equal(next.locked,false);
 await assert.doesNotReject(()=>apply(s,s.accounts[0],'swap',{roundId:'round1',p1:s.players[0].id,p2:ids[0]},now+minute));assert.ok(s.matches.find(m=>m.id==='m10')!.a.includes(ids[0]));const recorded=structuredClone(s.matches[0]);await assert.rejects(()=>apply(s,s.accounts[0],'swap',{roundId:'round0',p1:s.players[0].id,p2:ids[1]},now+minute),/已录分或已结束/);assert.deepEqual(s.matches[0],recorded);
});

test('future forfeits expire the conditional validator exactly when the next court may start',async()=>{
 const s=fixture(),at=now+minute+1234;s.matches[0].status='forfeit';s.matches[0].end=at;
 assert.equal(readyScheduledMatches(s,s.events[0],at-1).length,0);
 assert.equal(clubViewValidUntil(s,s.accounts[0],at-1),at);
 assert.equal(await startDuePointsSessions(s,at,apply),true);assert.equal(s.matches.find(m=>m.id==='m10')!.start,at);
});
