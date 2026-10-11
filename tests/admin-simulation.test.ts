import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation,changeSimulation,simulationView} from '../lib/admin-simulation';
import {pendingSchedulingIds,schedulingMode} from '../lib/domain/scheduling';
import {liveAppearances} from '../lib/domain/live-play';
const now=Date.parse('2030-10-10T13:03:00Z');
const request=()=>crypto.randomUUID();
const start=(d:ReturnType<typeof createSimulation>)=>({eventId:'sim-event',expectedMode:schedulingMode(d.state,d.state.events[0]),expectedPendingIds:pendingSchedulingIds(d.state,'sim-event')});
test('simulation is a closed 12-player, two-court graph with confirmed signups and no real identities',()=>{
 const d=createSimulation(now),s=d.state;assert.equal(s.players.length,12);assert.equal(s.accounts.length,12);assert.equal(s.registrations.length,12);assert.ok(s.registrations.every(r=>r.status==='confirmed'&&r.arrival<=now&&r.departure>now));assert.equal(s.bookings.length,2);assert.equal(new Set(s.bookings.map(b=>b.name)).size,2);assert.ok(s.players.every(p=>p.id.startsWith('sim-')&&p.name.startsWith('模拟球友')));assert.ok(s.accounts.every(a=>a.email===''));assert.equal(simulationView(d,now).data.quarterlyLeaderboard.length,12);assert.equal(s.matches.length,0);
});
test('real live scheduler uses both courts, rotates the bench, and persists scores only in the simulation document',async()=>{
 const original=createSimulation(now);let d=await changeSimulation(original,'pointsStart',start(original),request(),now);assert.equal(original.state.matches.length,0);assert.equal(d.state.matches.filter(m=>m.status==='playing').length,2);assert.equal(new Set(d.state.matches.flatMap(m=>[...m.a,...m.b])).size,8);
 for(let i=0;i<12;i++){const active=d.state.matches.filter(m=>m.status==='playing'),m=active.find(m=>m.courtId==='sim-court-'+(i%2+1))!,other=structuredClone(active.find(x=>x.id!==m.id));const bench=d.state.players.filter(p=>!active.some(m=>[...m.a,...m.b].includes(p.id))).map(p=>p.id);d=await changeSimulation(d,'score',{matchId:m.id,a:21,b:19},request(),now+(i+1)*60000);const next=d.state.matches.find(x=>x.courtId===m.courtId&&x.status==='playing')!;assert.deepEqual(new Set([...next.a,...next.b]),new Set(bench));assert.deepEqual(d.state.matches.find(x=>x.id===other!.id),other)}
 const counts=d.state.players.map(p=>liveAppearances(d.state,'sim-event',p.id));assert.ok(Math.max(...counts)-Math.min(...counts)<=1);assert.equal(d.state.matches.filter(m=>m.status==='complete').length,12);
});
test('preplanning and reset use the same commands but never keep stale test scores or lateness',async()=>{
 let d=await changeSimulation(createSimulation(now),'preplan',{},request(),now);assert.equal(d.state.events[0].schedulingMode,'planned');assert.equal(d.state.rounds.length,6);assert.equal(d.state.matches.length,12);d=await changeSimulation(d,'pointsStart',start(d),request(),now+1000);const m=d.state.matches.find(m=>m.status==='playing')!;d=await changeSimulation(d,'pointsLate',{matchId:m.id,playerId:m.a[0],expectedA:m.a,expectedB:m.b,replacement:'player'},request(),now+2000);assert.equal(simulationView(d,now+2000).data.quarterlyLeaderboard.find(r=>r.playerId===m.a[0])!.points,-1);const before=d.revision;d=await changeSimulation(d,'reset',{},request(),now+24*3600000);assert.equal(d.revision,before+1);assert.equal(d.state.matches.length,0);assert.equal(d.state.players.length,12);assert.equal(d.state.events[0].pointsSession,undefined);assert.ok(d.state.events[0].end>now+24*3600000);
});
test('simulation refuses account, real event, notification, fee and profile operations without changing its state',async()=>{
 const d=createSimulation(now),before=structuredClone(d);for(const action of ['event','grantPoints','notifyFees','feePaid','profile','role','createAccount','photoUpload'])await assert.rejects(()=>changeSimulation(d,action,{},request(),now),/只允许/);assert.deepEqual(d,before);await assert.rejects(()=>changeSimulation(d,'liveStart',{eventId:'real-event'},request(),now),/不存在/);assert.deepEqual(d,before);
});
