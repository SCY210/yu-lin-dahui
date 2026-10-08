import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,type Match,type Round,type Event,type Registration} from '../lib/domain/types';
import {pendingOwnScores,createScorePromptGate,initialScoreDrafts,scoreEntryPayload,type ScoreReminderData} from '../lib/client/score-reminder';

const now=Date.parse('2026-10-09T12:00:00Z');
function fixture(){
 const s=emptyState();const me={id:'account',email:'',role:'member' as const,playerId:'self'};
 for(const id of ['self','partner','a','b','proxy'])s.players.push({id,name:id,ownerId:id==='proxy'?'account':id,enabled:true,initialRating:1000,rating:1000,ratedGames:0,ratingReason:''});
 const e:Event={id:'event',creatorId:'host',title:'虚构对局',start:now-3600000,end:now+3600000,venue:'虚构球馆',address:'',capacity:4,signupDeadline:now,cancelDeadline:now,note:'',status:'live',courtMode:'equal',ballMode:'equal'};
 const r:Round={id:'round',eventId:e.id,start:now-600000,duration:15,status:'playing',eligible:['self','partner','a','b'],rest:[],seed:1};
 const m:Match={id:'match',eventId:e.id,roundId:r.id,courtId:'court',a:['self','partner'],b:['a','b'],status:'playing',start:r.start,end:null,scoreA:null,scoreB:null,monthly:true,elo:true,locked:false,enteredBy:null,games:[]};
 const signup:Registration={id:'signup',eventId:e.id,playerId:'self',sequence:1,status:'confirmed',arrival:e.start,departure:e.end,note:'',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''}};
 s.events.push(e);s.rounds.push(r);s.matches.push(m);s.registrations.push(signup);return {...s,me};
}
test('an ongoing own game is pending; complete, cancelled, forfeit, draft, future and missing parents are excluded',()=>{
 const s=fixture();assert.deepEqual(pendingOwnScores(s,now).map(m=>m.id),['match']);
 for(const status of ['complete','cancelled','forfeit','draft','published'] as const){const copy=structuredClone(s);copy.matches[0].status=status;assert.equal(pendingOwnScores(copy,now).length,0)}
 for(const invalid of [null,now+1,NaN]){const copy=structuredClone(s);copy.matches[0].start=invalid;assert.equal(pendingOwnScores(copy,now).length,0)}
 const missing=structuredClone(s);missing.rounds=[];assert.equal(pendingOwnScores(missing,now).length,0);missing.rounds=s.rounds;missing.events=[];assert.equal(pendingOwnScores(missing,now).length,0);
});
test('proxy ownership and administrator authority do not trigger another player’s score prompt',()=>{
 const s=fixture();s.matches[0].a=['proxy','partner'];assert.equal(pendingOwnScores(s,now).length,0);
 const admin={...s,me:{...s.me,role:'admin' as const}};assert.equal(pendingOwnScores(admin,now).length,0);
 s.matches[0].b=['self','a'];assert.equal(pendingOwnScores(s,now).length,1);
});
test('event visibility, cancelled rounds, disabled self and stored scoring authority remain required',()=>{
 const s=fixture();for(const status of ['draft','cancelled'] as const){const copy=structuredClone(s);copy.events[0].status=status;assert.equal(pendingOwnScores(copy,now).length,0)}
 s.events[0].deletedAt=now;assert.equal(pendingOwnScores(s,now).length,0);delete s.events[0].deletedAt;
 s.rounds[0].status='cancelled';assert.equal(pendingOwnScores(s,now).length,0);s.rounds[0].status='playing';
 s.players[0].enabled=false;assert.equal(pendingOwnScores(s,now).length,0);s.players[0].enabled=true;
 s.registrations=[];assert.equal(pendingOwnScores(s,now).length,0);s.me.role='member';
 const host:ScoreReminderData={...s,me:{...s.me,id:'host'}};assert.equal(pendingOwnScores(host,now).length,1);
});
test('recent unfinished games are first, ending an activity does not discard its unrecorded own game',()=>{
 const s=fixture();s.events[0].status='ended';s.matches.push({...s.matches[0],id:'older',start:now-1800000},{...s.matches[0],id:'a-same-time'});
 assert.deepEqual(pendingOwnScores(s,now).map(m=>m.id),['a-same-time','match','older']);
 s.matches[0].status='complete';assert.ok(!pendingOwnScores(s,now).some(m=>m.id==='match'));
});
test('one prompt per visit: initial empty load, polling and a new live assignment never repeatedly interrupt',()=>{
 const gate=createScorePromptGate('account');const visit=gate.begin();gate.ready(visit,'account');assert.equal(gate.next('account',[],false),null);assert.equal(gate.next('account',['new-live-game'],false),null);
 const resumed=gate.begin();gate.ready(resumed,'account');assert.equal(gate.next('account',['new-live-game'],false),'new-live-game');assert.equal(gate.next('account',['another-game'],false),null);
});
test('blocked dialogs defer the prompt, a manual dismissal suppresses the current visit, return to app allows retry',()=>{
 const gate=createScorePromptGate('account');const visit=gate.begin();gate.ready(visit,'account');assert.equal(gate.next('account',['match'],true),null);assert.equal(gate.next('account',['match'],false),'match');gate.suppress();assert.equal(gate.next('account',['match'],false),null);
 const returnVisit=gate.begin();gate.ready(returnVisit,'account');assert.equal(gate.next('account',['match'],false),'match');
 const manual=createScorePromptGate('account');const token=manual.begin();manual.ready(token,'account');manual.suppress();assert.equal(manual.next('account',['match'],false),null);
});
test('old foreground responses and other accounts cannot arm a score prompt',()=>{
 const gate=createScorePromptGate('account'),old=gate.begin(),latest=gate.begin();gate.ready(old,'account');assert.equal(gate.next('account',['old'],false),null);gate.ready(latest,'other');assert.equal(gate.next('account',['other'],false),null);gate.ready(latest,'account');assert.equal(gate.next('other',['match'],false),null);assert.equal(gate.next('account',['match'],false),'match');
});
test('unrecorded scores stay blank and existing results are copied without guessed extra games',()=>{
 assert.deepEqual(initialScoreDrafts({games:[]}),[{a:'',b:''},{a:'',b:''},{a:'',b:''}]);
 const m={games:[{a:21,b:19}]};const draft=initialScoreDrafts(m);assert.deepEqual(draft,[{a:21,b:19},{a:'',b:''},{a:'',b:''}]);draft[0].a=0;assert.equal(m.games[0].a,21);
});
test('blank values cannot silently become zero; new scores use server time and corrections retain exact historical time',()=>{
 const m=fixture().matches[0];assert.throws(()=>scoreEntryPayload(m,[{a:21,b:''}],1,'完成'),/实际比分/);
 assert.throws(()=>scoreEntryPayload(m,[{a:NaN,b:15}],1,'完成'),/实际比分/);
 const first=scoreEntryPayload(m,[{a:21,b:0}],1,'完成');assert.equal(first.games[0].b,0);assert.equal(Object.hasOwn(first,'end'),false);
 const end=now-12345,corrected=scoreEntryPayload({...m,status:'complete',end},[{a:21,b:19}],1,'修正');assert.equal(corrected.end,end);
});
