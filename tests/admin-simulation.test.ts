import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation,changeSimulation,simulationView} from '../lib/admin-simulation';
import {pendingSchedulingIds,schedulingMode} from '../lib/domain/scheduling';
import {liveAppearances} from '../lib/domain/live-play';
import {emptyState} from '../lib/domain/types';
import {realmSnapshot} from '../lib/domain/realm-rating';
const now=Date.parse('2030-10-10T13:03:00Z');
const request=()=>crypto.randomUUID();
const start=(d:ReturnType<typeof createSimulation>)=>({eventId:'sim-event',expectedMode:schedulingMode(d.state,d.state.events[0]),expectedPendingIds:pendingSchedulingIds(d.state,'sim-event')});
test('simulation is a closed 12-player, two-court graph with confirmed signups and no real identities',()=>{
 const d=createSimulation(now),s=d.state;assert.equal(s.players.length,12);assert.equal(s.accounts.length,12);assert.equal(s.registrations.length,12);assert.ok(s.registrations.every(r=>r.status==='confirmed'&&r.arrival<=now&&r.departure>now));assert.equal(s.bookings.length,2);assert.equal(new Set(s.bookings.map(b=>b.name)).size,2);assert.ok(s.players.every(p=>p.id.startsWith('sim-')&&p.name.startsWith('模拟球友')));assert.ok(s.accounts.every(a=>a.email===''));assert.equal(simulationView(d,now).data.quarterlyLeaderboard.length,12);assert.equal(s.matches.length,0);
});
test('real live scheduler uses both courts, rotates the bench, and persists scores only in the simulation document',async()=>{
 const original=createSimulation(now);let d=await changeSimulation(original,'pointsStart',start(original),request(),now);assert.equal(original.state.matches.length,0);assert.equal(d.state.matches.filter(m=>m.status==='playing').length,2);assert.equal(new Set(d.state.matches.flatMap(m=>[...m.a,...m.b])).size,8);
 for(let i=0;i<12;i++){const active=d.state.matches.filter(m=>m.status==='playing'),m=active.find(m=>m.courtId==='sim-court-'+(i%2+1))!,other=structuredClone(active.find(x=>x.id!==m.id));const bench=d.state.players.filter(p=>!active.some(m=>[...m.a,...m.b].includes(p.id))).map(p=>p.id);d=await changeSimulation(d,'score',{matchId:m.id,a:21,b:19},request(),now+(i+1)*60000);d=await changeSimulation(d,'liveNext',{eventId:'sim-event',courtId:m.courtId,allowSame:true},request(),now+(i+1)*60000);const next=d.state.matches.find(x=>x.courtId===m.courtId&&x.status==='playing')!;for(const id of m.a)assert.ok([...next.a,...next.b].includes(id),'simulation retains winners without a forced break');assert.ok(!d.state.events[0].livePlay!.rest.some(r=>r.reason==='win-limit'));assert.ok([...next.a,...next.b].filter(id=>bench.includes(id)).length>=2,"bench players join retained winners");assert.deepEqual(d.state.matches.find(x=>x.id===other!.id),other)}
 const counts=d.state.players.map(p=>liveAppearances(d.state,'sim-event',p.id));assert.ok(counts.every(n=>n>0));assert.equal(d.state.matches.filter(m=>m.status==='complete').length,12);
});
test('preplanning and reset use the same commands but never keep stale test scores or lateness',async()=>{
 let d=await changeSimulation(createSimulation(now),'preplan',{},request(),now);assert.equal(d.state.events[0].schedulingMode,'planned');assert.equal(d.state.rounds.length,6);assert.equal(d.state.matches.length,12);d=await changeSimulation(d,'pointsStart',start(d),request(),now+1000);const m=d.state.matches.find(m=>m.status==='playing')!;d=await changeSimulation(d,'pointsLate',{matchId:m.id,playerId:m.a[0],expectedA:m.a,expectedB:m.b,replacement:'player'},request(),now+2000);assert.equal(simulationView(d,now+2000).data.quarterlyLeaderboard.find(r=>r.playerId===m.a[0])!.points,-1);const before=d.revision;d=await changeSimulation(d,'reset',{},request(),now+24*3600000);assert.equal(d.revision,before+1);assert.equal(d.state.matches.length,0);assert.equal(d.state.players.length,12);assert.equal(d.state.events[0].pointsSession,undefined);assert.ok(d.state.events[0].end>now+24*3600000);
});
test('simulation refuses account, real event, notification, fee and profile operations without changing its state',async()=>{
 const d=createSimulation(now),before=structuredClone(d);for(const action of ['event','grantPoints','notifyFees','feePaid','profile','role','createAccount','photoUpload'])await assert.rejects(()=>changeSimulation(d,action,{},request(),now),/只允许/);assert.deepEqual(d,before);await assert.rejects(()=>changeSimulation(d,'liveStart',{eventId:'real-event'},request(),now),/不存在/);assert.deepEqual(d,before);
});

test('restored planned simulation uses current per-court score continuation and overlapping round states',async()=>{
 let d=await changeSimulation(createSimulation(now),'preplan',{},request(),now);
 d=await changeSimulation(d,'publishPoints',{eventId:'sim-event'},request(),now+1);
 d=await changeSimulation(d,'pointsStart',start(d),request(),now+2);
 const first=d.state.matches.find(m=>m.status==='playing')!,round=d.state.rounds.find(r=>r.id===first.roundId)!,nextRound=d.state.rounds.find(r=>r.pointsSlot===(round.pointsSlot??0)+1)!;
 const next=d.state.matches.find(m=>m.roundId===nextRound.id&&m.courtId===first.courtId)!;next.a=[...first.a];next.b=[...first.b];
 const second=d.state.matches.find(m=>m.roundId===first.roundId&&m.id!==first.id)!;
 const saved=await changeSimulation(d,'score',{matchId:first.id,a:21,b:19},request(),now+1000);
 assert.equal(saved.state.matches.find(m=>m.id===next.id)!.status,'playing');
 assert.equal(saved.state.matches.find(m=>m.id===second.id)!.status,'playing');
 assert.equal(saved.state.rounds.find(r=>r.id===round.id)!.status,'playing');
 assert.equal(saved.state.rounds.find(r=>r.id===nextRound.id)!.status,'playing');
 assert.equal(d.state.matches.find(m=>m.id===first.id)!.status,'playing','command copies never mutate the previous document');
});

test('the current event ranking switch changes only the isolated simulation event',async()=>{
 const d=createSimulation(now);const next=await changeSimulation(d,'eventRanking',{eventId:'sim-event',ranked:false,expectedRanked:true},request(),now);
 assert.equal(next.state.events[0].ranked,false);assert.equal(d.state.events[0].ranked,undefined);
 await assert.rejects(()=>changeSimulation(next,'eventRanking',{eventId:'real-event',ranked:true,expectedRanked:false},request(),now),/不存在/);
});

test('real member snapshots preserve names, avatars, gender and replayed strength with isolated identities',async()=>{
 const club=emptyState();for(let i=0;i<14;i++){const id='real-'+i;club.accounts.push({id:'account-'+i,email:'private@example.test',role:'member',playerId:id});club.players.push({id,ownerId:'account-'+i,name:'真实球友 '+i,enabled:i!==0,initialRating:2000,rating:2000,ratedGames:20,ratingReason:'private note',avatarId:'avatar-'+i,profile:{gender:i%2?'female':'male',years:5,hand:'left',preference:'mixed',style:'private style',equipment:'private equipment'}})}
 club.players.unshift({...club.players[1],id:'invited',name:'代报朋友'});
 club.audits=[300,300,50].map((rating,i)=>({id:'seed-'+i,actor:'account-1',action:'grantPoints',reason:'test strength',at:now-100,changes:{playerId:'real-1',period:'2030-10',points:0,rating,reason:'test strength'}}));
 const original=structuredClone(club),d=createSimulation(now,club);assert.equal(d.version,2);assert.equal(d.state.players.length,12);assert.equal(d.state.bookings.length,2);assert.equal(d.state.players[0].name,'真实球友 1');assert.equal(d.state.players[0].avatarId,'avatar-1');assert.equal(d.state.players[0].profile?.gender,'female');assert.equal(d.state.players[0].rating,1650);assert.equal(realmSnapshot(d.state,now).get('sim-player-1')!.score,1650);assert.ok(d.state.players.every(p=>p.id.startsWith('sim-')&&p.ownerId.startsWith('sim-')));assert.ok(!JSON.stringify(d).includes('private@example.test'));assert.ok(!JSON.stringify(d).includes('private style'));assert.ok(!JSON.stringify(d).includes('real-1"'));assert.ok(simulationView(d,now).data.quarterlyLeaderboard.every(r=>r.points===0&&r.games===0));
 const live=await changeSimulation(d,'pointsStart',start(d),request(),now),m=live.state.matches[0];await changeSimulation(live,'score',{matchId:m.id,a:21,b:19},request(),now+1000);assert.deepEqual(club,original);
 club.players[1].name='刷新后的球友';club.players[1].enabled=false;const reset=await changeSimulation(live,'reset',{},request(),now+2000,club);assert.ok(!reset.state.players.some(p=>p.name==='代报朋友'));assert.equal(reset.state.matches.length,0);assert.equal(reset.revision,live.revision+1);
});

test('fewer members never create fictional replacements, while an empty roster refuses initialization',()=>{
 const club=createSimulation(now).state;club.players=club.players.slice(0,5);const d=createSimulation(now,club);assert.equal(d.state.players.length,5);assert.equal(d.state.registrations.length,5);assert.equal(d.state.bookings.length,2);assert.equal(d.state.events[0].capacity,5);assert.match(d.state.events[0].title,/5人/);club.players=[];assert.throws(()=>createSimulation(now,club),/暂无可用于模拟的真实球友/);
});
