import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,type Match} from '../lib/domain/types';
import {projectClubState} from '../lib/club-view';
import {doublesQuarterlyLeaderboard} from '../lib/domain/ranking';

function fixture(){
 const s=emptyState();
 for(const id of ['A','B','C','D']){s.players.push({id,name:id,ownerId:id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''});s.accounts.push({id,email:'',role:'member',playerId:id})}
 return s;
}
function match(id:string,start:string,won=true,singles=false):Match{
 const at=Date.parse(start),scores=[{a:won?21:10,b:won?10:21}];
 return {id,eventId:'event-'+id,roundId:'round-'+id,courtId:'court',a:singles?['A']:['A','B'],b:singles?['C']:['C','D'],status:'complete',start:at,end:at+60000,scoreA:scores[0].a,scoreB:scores[0].b,games:scores,monthly:true,elo:true,locked:false,enteredBy:'A'};
}
const player=(s:ReturnType<typeof fixture>,id:string,at:number)=>projectClubState(s,s.accounts[0],'2026-10',2026,at).players.find(p=>p.id===id)!;

test('avatar losing streaks count current-quarter rated losses and a win resets them',()=>{
 const s=fixture();s.matches.push(match('l1','2026-10-01T12:00:00Z',false),match('l2','2026-10-02T12:00:00Z',false),match('l3','2026-10-03T12:00:00Z',false),match('s1','2026-10-03T15:00:00Z',false,true));
 const at=Date.parse('2026-10-04T12:00:00Z');
 assert.deepEqual(player(s,'A',at).losingStreak,{singles:1,doubles:0},'the latest game was singles, so only that run shows');
 assert.deepEqual(player(s,'C',at).losingStreak,{singles:0,doubles:0},'the winners have no losing streak');
 assert.deepEqual(player(s,'C',at).winningStreak,{singles:1,doubles:0});
 s.matches.push(match('l4','2026-10-03T16:00:00Z',false));
 assert.deepEqual(player(s,'A',at).losingStreak,{singles:0,doubles:4},'back in doubles, the doubles run kept counting');
 s.matches.push(match('w','2026-10-04T13:00:00Z',true));
 assert.equal(player(s,'A',at+2*3600000).losingStreak.doubles,0,'a win ends the losing run');
 assert.equal(player(s,'A',Date.parse('2027-01-02T12:00:00Z')).losingStreak.singles,0,'a new quarter starts over');
});

test('losing streaks change no season points and hide disabled players',()=>{
 const s=fixture();s.matches.push(match('l1','2026-10-01T12:00:00Z',false),match('l2','2026-10-02T12:00:00Z',false));
 const at=Date.parse('2026-10-03T12:00:00Z');
 assert.equal(doublesQuarterlyLeaderboard(s,'2026-Q4',at).find(r=>r.playerId==='A')!.points,-2,'each loss is still just -1');
 s.players.find(p=>p.id==='B')!.enabled=false;s.accounts=s.accounts.filter(a=>a.playerId!=='B');
 assert.deepEqual(player(s,'B',at).losingStreak,{singles:0,doubles:0});
});

test('the avatar shows the live state: only the format of the most recent rated game counts',()=>{
 const s=fixture();s.matches.push(match('s1','2026-10-01T12:00:00Z',true,true),match('s2','2026-10-02T12:00:00Z',true,true));
 const at=Date.parse('2026-10-05T12:00:00Z');
 assert.deepEqual(player(s,'A',at).winningStreak,{singles:2,doubles:0});
 s.matches.push(match('d1','2026-10-03T12:00:00Z',false));
 assert.deepEqual(player(s,'A',at).winningStreak,{singles:0,doubles:0},'a fresh doubles loss hides the older singles run');
 assert.deepEqual(player(s,'A',at).losingStreak,{singles:0,doubles:1});
 s.matches.push(match('d2','2026-10-03T15:00:00Z',false));
 assert.deepEqual(player(s,'A',at).losingStreak,{singles:0,doubles:2});
 s.matches.push(match('s3','2026-10-04T12:00:00Z',true,true));
 assert.deepEqual(player(s,'A',at).winningStreak,{singles:3,doubles:0},'back in singles, the still-unbroken singles run shows again');
 assert.deepEqual(player(s,'A',at).losingStreak,{singles:0,doubles:0});
});
