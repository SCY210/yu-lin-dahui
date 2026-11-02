import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation} from './helpers/scheduling-fixture';
import {apply} from '../lib/domain/commands';
import {deleteUnplayedPlanned} from '../lib/domain/planned-cleanup';

const now=Date.parse('2030-10-10T13:00:00Z'),minute=60000;
test('when the activity ends, published planned games that never started are deleted; started ones and history stay',async()=>{
 const s=createSimulation(now).state,e=s.events[0],a=s.accounts[0];
 await apply(s,a,'planPoints',{eventId:e.id,at:now,pointsMinutes:45,roundMinutes:15,seed:1,pairing:'rotate'},now);
 await apply(s,a,'publishPoints',{eventId:e.id},now);
 const [first,second,third]=s.rounds.filter(r=>r.eventId===e.id).sort((x,y)=>x.start-y.start);
 await apply(s,a,'start',{roundId:first.id,at:now,monthly:true,elo:true},now);
 for(const m of s.matches.filter(m=>m.roundId===first.id))await apply(s,a,'score',{matchId:m.id,a:21,b:17},now+15*minute);
 // The second round is on court but unscored when the activity ends; the third never started.
 const playing=s.matches.filter(m=>m.roundId===second.id&&m.status==='playing');
 const unplayed=s.matches.filter(m=>m.roundId===third.id).map(m=>m.id);
 assert.ok(unplayed.length);
 assert.deepEqual(deleteUnplayedPlanned(s,e.end-minute),[],'nothing before the end');
 assert.deepEqual(deleteUnplayedPlanned(s,e.end).sort(),[...unplayed].sort());
 assert.ok(!s.rounds.some(r=>r.id===third.id),'the empty round goes too');
 assert.ok(s.matches.filter(m=>m.roundId===first.id).every(m=>m.status==='complete'),'results stay');
 assert.ok(playing.every(p=>s.matches.some(m=>m.id===p.id)),'a started game stays for its score');
 assert.deepEqual(deleteUnplayedPlanned(s,e.end+minute),[],'nothing changes twice');
 // An overtime round added after the end stays: it starts later on purpose.
 for(const m of playing)await apply(s,a,'score',{matchId:m.id,a:21,b:15},e.end+minute);
 await apply(s,a,'pointsNext',{eventId:e.id,expectedRoundIds:s.rounds.filter(r=>r.eventId===e.id&&r.status!=='cancelled').map(r=>r.id).sort()},e.end+2*minute);
 await apply(s,a,'pointsNext',{eventId:e.id,expectedRoundIds:s.rounds.filter(r=>r.eventId===e.id&&r.status!=='cancelled').map(r=>r.id).sort()},e.end+3*minute);
 assert.ok(s.rounds.some(r=>r.overtime&&r.status==='published'));
 assert.deepEqual(deleteUnplayedPlanned(s,e.end+4*minute),[],'overtime rounds are kept');
});
