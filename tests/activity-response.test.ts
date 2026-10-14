import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation} from './helpers/scheduling-fixture';
import {apply} from '../lib/domain/commands';
import {projectClubState} from '../lib/club-view';
import {clearSharedClubValues} from '../lib/club-view-shared';
import {createClubReadCache} from '../lib/club-read-cache';
import {createRefreshDelay} from '../lib/client/club-refresh';
import {requestedActivity,scopePending,validResponseScope,clubRefreshVersion} from '../lib/client/club-scope';
import {isClubResponse} from '../lib/client/club-response';

const now=Date.parse('2026-10-15T18:00:00Z');
async function fixture(){
 const s=createSimulation(now).state,a=s.accounts[0],e=s.events[0];
 await apply(s,a,'liveStart',{eventId:e.id},now);
 const match=s.matches[0];
 for(let i=0;i<12;i++){
  const eventId='history-'+i,start=now-(i+1)*86400000;
  s.events.push({...e,id:eventId,status:'ended',start,end:start+3*3600000});
  for(let j=0;j<20;j++)s.matches.push({...match,id:eventId+'m'+j,eventId,status:'complete',start:start+j*60000,end:start+(j+1)*60000,scoreA:21,scoreB:15,games:[{a:21,b:15}],enteredBy:a.id});
 }
 s.events.push({...e,id:'other-live'},{...e,id:'private-live',creatorId:'someone-else',status:'draft'});
 s.matches.push({...match,id:'occupied',eventId:'other-live',a:[s.players[8].id,s.players[9].id],b:[s.players[10].id,s.players[11].id]}, {...match,id:'secret',eventId:'private-live'});
 for(let i=0;i<600;i++)s.audits.push({id:'audit-'+i,at:now-1,actor:a.id,action:'fixture',reason:'Fictional history '.repeat(25)});
 s.revision=100;return {s,a,e};
}

test('activity responses preserve current scores, lineups, fees, identity and own achievements without historical payloads',async t=>{
 const {s,e}=await fixture();
 for(const a of s.accounts.slice(0,2)){
  clearSharedClubValues();
  const full=projectClubState(s,a,'2026-10',2026,now,{revision:s.revision});
  const part=projectClubState(s,a,'2026-10',2026,now,{revision:s.revision,activityId:e.id});
  assert.equal(part.activityScope,e.id);assert.ok(isClubResponse(part));
  for(const key of ['events','bookings','registrations','attendance','rounds','costs','settlements','payments','drafts','awardVotes'] as const){
   const expected=key==='events'?full.events.filter(row=>row.id===e.id):full[key].filter(row=>row.eventId===e.id);
   assert.deepEqual(part[key],expected,key);
  }
  assert.deepEqual(part.matches,full.matches.filter(m=>m.eventId===e.id||m.status==='playing'));
  assert.equal(part.matches.some(m=>m.id==='secret'),a.role==='admin','busy-court information obeys draft privacy');
  assert.deepEqual(part.players,full.players);assert.deepEqual(part.me,full.me);assert.deepEqual(part.settings,full.settings);
  assert.deepEqual(part.rotationPlans[e.id],full.rotationPlans[e.id]);
  for(const m of part.matches)assert.deepEqual(part.social.matchLevels[m.id],full.social.matchLevels[m.id]);
  assert.deepEqual(part.achievements[a.playerId],full.achievements[a.playerId]);
  assert.deepEqual(part.audits,[]);assert.deepEqual(part.ratingHistory,[]);assert.deepEqual(part.quarterlyLeaderboard,[]);
  assert.ok(JSON.stringify(part).length<JSON.stringify(full).length*.45,'activity response must shed the historical payload');
  t.diagnostic(JSON.stringify({viewer:a.role,fullBytes:Buffer.byteLength(JSON.stringify(full)),activityBytes:Buffer.byteLength(JSON.stringify(part))}));
  assert.deepEqual(projectClubState(s,a,'2026-10',2026,now,{revision:s.revision}),full,'activity caches cannot poison later full views');
 }
 clearSharedClubValues();
});

test('activity validators cannot answer another activity or a full-club request',()=>{
 const {state:s}=createSimulation(now),account=s.accounts[0],cache=createClubReadCache();
 const version={revision:1,settings:s.settings,account},identity={userId:account.id,method:'password',username:null,activityId:'a'};
 const token=cache.remember(version,identity,'2026-10',2026,now+15000,now)!;
 assert.equal(cache.match(token,version,identity,'2026-10',2026,now+3000),token);
 assert.equal(cache.match(token,version,{...identity,activityId:'b'},'2026-10',2026,now+3000),null);
 assert.equal(cache.match(token,version,{...identity,activityId:undefined},'2026-10',2026,now+3000),null);
 assert.equal(cache.match(token,{...version,account:{...account,role:'member'}},identity,'2026-10',2026,now+3000),null);
});

test('scope changes gate unrelated screens and revision-based polling never slows live score updates',()=>{
 const activity={activityScope:'a',revision:1,me:{id:'viewer'}};
 assert.equal(requestedActivity('events','a'),'a');assert.equal(requestedActivity('ranking','a'),'');
 assert.equal(scopePending(activity,'a'),false);assert.equal(scopePending(activity,'b'),true);assert.equal(scopePending(activity,''),true);
 assert.equal(validResponseScope(activity,'b'),false);assert.equal(validResponseScope({},'b'),true,'full fallback recovers deleted or private activity');
 const live=createRefreshDelay({base:3000,maximum:3000,version:clubRefreshVersion});
 for(let i=0;i<3600;i++)assert.equal(live.next(activity),3000);
 const quiet=createRefreshDelay({base:15000,maximum:60000,version:clubRefreshVersion});
 assert.deepEqual(Array.from({length:6},()=>quiet.next(activity)),[15000,15000,30000,30000,60000,60000]);
 assert.equal(quiet.next({...activity,revision:2}),15000);
 quiet.next(activity);quiet.reset();assert.equal(quiet.next(activity),15000);
 assert.equal(live.next(undefined),6000);assert.equal(live.next(undefined),12000);assert.equal(live.next(activity),3000);
 let elapsed=0,polls=0;quiet.reset();while(elapsed<3*3600000){polls++;elapsed+=quiet.next(activity)}
 assert.ok(polls*20<4000,`quiet browsing budget: ${polls*20}`);
 assert.equal(20*3*3600000/3000,72000,'even continuous live polling retains the validated request ceiling');
});
