import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apply} from '../lib/domain/commands';
import {emptyState,type Event} from '../lib/domain/types';
import {newTournament,finishedGame,type ScoringRule} from '../lib/domain/tournament';
import {applyLiveOp,canRefereeMatch,finalGames,liveElapsed,liveTally,type LiveOpBody,type LiveScore,type Side} from '../lib/domain/live-score';

const best3:ScoringRule={games:3,points:21},now=Date.parse('2030-10-10T13:00:00Z');
const points=(...sides:[Side,number][])=>sides.flatMap(([side,n])=>Array.from({length:n},(_,i)=>({type:'point' as const,side,at:i})));
/** n rallies won alternately by each side, so neither ever leads by two. */
const even=(n:number)=>Array.from({length:n},(_,i)=>[{type:'point' as const,side:'b' as Side,at:i},{type:'point' as const,side:'a' as Side,at:i}]).flat();
const run=(ops:LiveOpBody[],rule=best3,start:LiveScore|null=null)=>ops.reduce<LiveScore|null>((s,op,i)=>applyLiveOp(s,{...op,matchId:'m'} as never,rule,{matchId:'m',eventId:'e'},now+i*1000),start)!;

test('the tally follows games to 21, deuce and the cap, and ends at two games won',()=>{
 assert.deepEqual(liveTally(best3,points(['a',20],['b',20],['a',1])).current,{a:21,b:20},'deuce: 21:20 goes on');
 const two=liveTally(best3,[...points(['a',20],['b',20],['a',2]),...even(29)]);
 assert.deepEqual(two.games,[{a:22,b:20}]);assert.deepEqual(two.current,{a:29,b:29});
 const capped=liveTally(best3,[...points(['a',20],['b',20],['a',2]),...even(29),...points(['b',1])]);
 assert.deepEqual(capped.games,[{a:22,b:20},{a:29,b:30}],'30 wins outright');assert.deepEqual(capped.wins,{a:1,b:1});
 const third=liveTally(best3,[...points(['a',21]),...points(['b',21]),...points(['a',10],['b',10],['a',1])]);
 assert.equal(third.changeEnds,true,'deciding game at 11: change ends');assert.equal(third.interval,true);
 const done=liveTally(best3,[...points(['a',21]),...points(['b',21]),...points(['a',21]),...points(['b',5])]);
 assert.equal(done.winner,'a');assert.deepEqual(done.games.length,3,'points after the end are ignored');
 assert.equal(liveTally({games:1,points:15},points(['b',15])).winner,'b');
});

test('the referee starts, pauses, resumes and changes ends; the clock leaves out pauses',()=>{
 assert.throws(()=>run([{op:'point',side:'a'}]),/开始比赛/);
 const s=run([{op:'start'},{op:'point',side:'a'},{op:'pause'}]);
 assert.equal(s.status,'paused');assert.throws(()=>run([{op:'point',side:'a'}],best3,s),/暂停/);
 const resumed=applyLiveOp(s,{op:'resume',matchId:'m'},best3,{matchId:'m',eventId:'e'},now+60000);
 assert.equal(liveElapsed(resumed,now+70000),now+70000-s.startedAt!-(now+60000-s.pausedAt!));
 const swapped=run([{op:'swap'}],best3,resumed);assert.equal(swapped.swapped,true);assert.equal(swapped.version,resumed.version+1);
});

test('a double tap takes back that side\'s last point, including one from a red card',()=>{
 let s=run([{op:'start'},{op:'point',side:'a'},{op:'point',side:'b'},{op:'point',side:'a'},{op:'undo',side:'b'}]);
 assert.deepEqual(liveTally(best3,s.events).current,{a:2,b:0});
 s=run([{op:'card',side:'a',kind:'red'}],best3,s);assert.deepEqual(liveTally(best3,s.events).current,{a:2,b:1},'red card: the opponent scores');
 s=run([{op:'card',side:'a',kind:'yellow'}],best3,s);assert.deepEqual(liveTally(best3,s.events).current,{a:2,b:1},'yellow card: no point');
 s=run([{op:'undo',side:'b'}],best3,s);assert.deepEqual(liveTally(best3,s.events).current,{a:2,b:0});
 s=run([{op:'uncard'}],best3,s);assert.equal(s.events.filter(e=>e.type==='card').length,0);
 assert.throws(()=>run([{op:'undo',side:'b'}],best3,s),/没有可撤销/);
});

test('winning ends the match, an undo reopens it, and the saved games are always valid',()=>{
 const won=run([{op:'start'},...Array.from({length:42},()=>({op:'point' as const,side:'a' as const}))]);
 assert.equal(won.status,'finished');assert.deepEqual(finalGames(best3,liveTally(best3,won.events)),[{a:21,b:0},{a:21,b:0}]);
 assert.throws(()=>run([{op:'point',side:'a'}],best3,won),/已经结束/);
 const reopened=run([{op:'undo',side:'a'}],best3,won);assert.equal(reopened.status,'playing');
 // A black card mid-game: the opponent takes that game and the next with the fewest points that finish them.
 const black=run([{op:'start'},...points(['a',21]).map(()=>({op:'point' as const,side:'a' as const})),{op:'point',side:'a'},{op:'point',side:'b'},{op:'card',side:'a',kind:'black'}]);
 const t=liveTally(best3,black.events);assert.equal(black.status,'finished');assert.equal(t.winner,'b');assert.equal(t.disqualified,'a');
 const games=finalGames(best3,t);assert.deepEqual(games,[{a:21,b:0},{a:1,b:21},{a:0,b:21}]);assert.ok(games.every(g=>finishedGame(best3,g.a,g.b)));
 const late=finalGames(best3,{...t,games:[],wins:{a:0,b:0},current:{a:29,b:28}});assert.deepEqual(late[0],{a:29,b:30},'the cap still finishes a long game');
});

test('organisers assign a referee who is not playing; the referee may score that match only',async()=>{
 const s=emptyState();s.settings.initialized=true;s.settings.ownerAccountId='owner';
 s.accounts=Array.from({length:6},(_,i)=>({id:i?'member'+i:'owner',email:'',playerId:'p'+i,role:i?'member' as const:'admin' as const}));
 s.players=s.accounts.map(a=>({id:a.playerId,name:a.playerId,ownerId:a.id,enabled:true,initialRating:1000,rating:1000,ratedGames:0,ratingReason:''}));
 const e:Event={id:'t',creatorId:'owner',title:'Fictional competition',matchFormat:'singles',tournament:{...newTournament(),autoArrange:false},start:now-3600000,end:now+24*3600000,venue:'Fixture venue',address:'',capacity:6,note:'',signupDeadline:now,cancelDeadline:now-86400000,status:'open',attendanceMode:'automatic',courtMode:'interval',ballMode:'interval'};
 e.tournament!.format='knockout';s.events=[e];s.bookings=[{id:'court0',eventId:e.id,name:'Court 0',start:e.start,end:e.end,pricing:'total',cents:0}];
 s.registrations=s.players.slice(0,4).map((p,i)=>({id:'reg'+i,eventId:e.id,playerId:p.id,sequence:i,status:'confirmed',arrival:e.start,departure:e.end,note:'',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''}}));
 const [owner,,,,referee,stranger]=s.accounts;
 await apply(s,owner,'tournamentDraw',{eventId:e.id,teams:[['p0'],['p1'],['p2'],['p3']],seed:1,seeded:true},now);
 const f=e.tournament!.fixtures[0];
 await assert.rejects(()=>apply(s,referee,'tournamentReferee',{eventId:e.id,fixtureId:f.id,playerId:'p4'},now),/403/);
 await assert.rejects(()=>apply(s,owner,'tournamentReferee',{eventId:e.id,fixtureId:f.id,playerId:'p0'},now),/不能给自己的比赛当裁判/);
 await apply(s,owner,'tournamentReferee',{eventId:e.id,fixtureId:f.id,playerId:'p4'},now);assert.equal(f.referee,'p4');
 await apply(s,owner,'tournamentStart',{eventId:e.id,fixtureId:f.id,courtId:'court0'},now);
 assert.ok(canRefereeMatch(referee,e,f.matchId!));assert.ok(!canRefereeMatch(stranger,e,f.matchId!));assert.ok(canRefereeMatch(owner,e,f.matchId!));
 await assert.rejects(()=>apply(s,stranger,'score',{matchId:f.matchId!,a:21,b:10,games:[{a:21,b:10},{a:21,b:10}]},now+60000),/403/);
 await apply(s,referee,'score',{matchId:f.matchId!,a:21,b:10,games:[{a:21,b:10},{a:21,b:10}],reason:'裁判实时记分'},now+60000);
 assert.equal(s.matches.find(m=>m.id===f.matchId)!.status,'complete');
 await apply(s,owner,'tournamentReferee',{eventId:e.id,fixtureId:f.id,playerId:null},now);assert.equal(f.referee,undefined);
});
