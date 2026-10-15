import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation} from './helpers/scheduling-fixture';
import {apply} from '../lib/domain/commands';
import {canEnterUnstartedScore} from '../lib/domain/score-entry';
import type {Match,Round} from '../lib/domain/types';
const now=Date.parse('2030-10-10T13:05:00Z'),minute=60000;
function fixture(){
 const s=createSimulation(now).state,e=s.events[0];e.schedulingMode='planned';
 for(let n=0;n<2;n++){
  const r:Round={id:'round'+n,eventId:e.id,start:now+(n+1)*15*minute,duration:15,status:n?'published':'playing',eligible:s.players.map(p=>p.id),rest:[],seed:n+1,pointsSlot:n+1};s.rounds.push(r);
  for(let c=0;c<2;c++){const ids=s.players.slice(c*4,c*4+4).map(p=>p.id);const m:Match={id:'match'+n+c,eventId:e.id,roundId:r.id,courtId:s.bookings[c].id,a:ids.slice(0,2),b:ids.slice(2),status:c===1&&n===0?'playing':'published',start:c===1&&n===0?now-1000:null,end:null,scoreA:null,scoreB:null,games:[],locked:false,enteredBy:null,monthly:true,elo:true};s.matches.push(m)}
 }
 return s;
}
test('a pending court in an already-playing planned round remains directly scoreable',async()=>{
 const s=fixture(),m=s.matches[0],other=structuredClone(s.matches[1]);assert.equal(canEnterUnstartedScore(m,s),true);
 await apply(s,s.accounts[0],'score',{matchId:m.id,a:21,b:18},now);
 assert.equal(m.status,'complete');assert.ok(m.start!<now);assert.equal(m.end,now);assert.equal(m.earlyScoreAt,undefined);
 assert.equal(s.matches.find(m=>m.id==='match10')!.status,'playing');assert.equal(s.matches.find(m=>m.id==='match10')!.start,now);
 assert.deepEqual(s.matches[1],other);assert.deepEqual(s.rounds.map(r=>r.status),['playing','playing']);
});
test('recording a published result is not a new availability check at the planned time',async()=>{
 for(const kind of ['late-arrival','early-departure','other-match']){
  const s=fixture(),m=s.matches[0],player=m.a[0],reg=s.registrations.find(r=>r.playerId===player)!;
  if(kind==='late-arrival')reg.arrival=now+60*minute;
  if(kind==='early-departure')reg.departure=now-1000;
  if(kind==='other-match')s.matches[1].a[0]=player;
  await assert.doesNotReject(()=>apply(s,s.accounts[0],'score',{matchId:m.id,a:21,b:17},now),kind);
  assert.equal(m.status,'complete',kind);assert.equal(m.end,now,kind);
 }
});
test('late entry after the activity end and outdated estimated slots remain scoreable',async()=>{
 const s=fixture(),e=s.events[0],m=s.matches[0];s.rounds[0].start=e.end+minute;
 await apply(s,s.accounts[0],'score',{matchId:m.id,a:21,b:19},e.end+60*minute);
 assert.equal(m.start,e.end-1);assert.equal(m.end,e.end);assert.equal(m.status,'complete');
});
test('drafts, cancelled activities, malformed lineups and invalid final scores remain protected',async()=>{
 for(const kind of ['draft','cancelled','duplicate','unknown','invalid-score']){
  const s=fixture(),m=s.matches[0];
  if(kind==='draft')m.status='draft';if(kind==='cancelled')s.events[0].status='cancelled';if(kind==='duplicate')m.a[0]=m.b[0];if(kind==='unknown')m.a[0]='missing';
  const before=structuredClone(s);
  await assert.rejects(()=>apply(s,s.accounts[0],'score',{matchId:m.id,a:21,b:kind==='invalid-score'?20:18},now),kind);assert.deepEqual(s,before,kind);
 }
});
