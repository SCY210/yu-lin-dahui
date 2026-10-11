import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apply} from '../lib/domain/commands';
import {liveAppearances,livePresentIds} from '../lib/domain/live-play';
import {realmLedger} from '../lib/domain/realm-rating';
import {gamePoints} from '../lib/domain/season-points';
import {emptyState,type Event} from '../lib/domain/types';

const now=Date.parse('2026-10-10T15:00:00Z');
function fixture(count=10,courts=2){
 const s=emptyState();s.settings.initialized=true;
 const e:Event={id:'event',creatorId:'owner',title:'虚构实时活动',start:now-3600000,end:now+3*3600000,venue:'球馆',address:'',capacity:count,signupDeadline:now,cancelDeadline:now-86400000,note:'',status:'open',attendanceMode:'automatic',courtMode:'equal',ballMode:'equal'};
 s.events.push(e);s.settings.ownerAccountId='owner';
 for(let i=0;i<count;i++){
  const id='p'+String(i).padStart(2,'0'),accountId=i?'member'+i:'owner';
  s.players.push({id,name:id,ownerId:accountId,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''});
  s.accounts.push({id:accountId,email:'',role:i?'member':'admin',playerId:id});
  s.registrations.push({id:'reg'+i,eventId:e.id,playerId:id,sequence:i,status:'confirmed',arrival:e.start,departure:e.end,note:'',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''}});
 }
 for(let i=0;i<courts;i++)s.bookings.push({id:'court'+i,eventId:e.id,name:'场地'+i,start:e.start,end:e.end,pricing:'total',cents:1000});
 return {s,e,owner:s.accounts[0]};
}
const active=(s:ReturnType<typeof emptyState>)=>s.matches.filter(m=>m.status==='playing');
const account=(s:ReturnType<typeof emptyState>,playerId:string)=>s.accounts.find(a=>a.playerId===playerId)!;

test('a no-show is one loss for the absent player only; the others keep their score and their turn',async()=>{
 const {s,e,owner}=fixture();await apply(s,owner,'liveStart',{eventId:e.id},now);
 const m=active(s)[0],absent=m.a[0],partner=m.a[1],present=[partner,...m.b],bench=livePresentIds(s,e,now).filter(id=>!active(s).some(x=>[...x.a,...x.b].includes(id)));
 await apply(s,account(s,m.b[0]),'noShow',{matchId:m.id,playerIds:[absent]},now+60000);
 const stored=s.matches.find(x=>x.id===m.id)!;
 assert.equal(stored.status,'forfeit');assert.deepEqual(stored.noShow,[absent]);assert.equal(stored.end,now+60000);
 const ledger=realmLedger(s,now+120000),games=ledger.byPlayer.get(absent)??[];
 assert.equal(games.length,1);assert.equal(games[0].won,false);assert.ok(games[0].delta<0,'修为 goes down');assert.equal(gamePoints(games[0]),-1,'season points −1');
 for(const id of present)assert.equal((ledger.byPlayer.get(id)??[]).length,0,id+' is not rated for this match');
 const onCourt=(id:string)=>active(s).some(x=>[...x.a,...x.b].includes(id))?1:0;
 for(const id of present)assert.equal(liveAppearances(s,e.id,id),onCourt(id),id+' did not use up a turn');
 assert.equal(liveAppearances(s,e.id,absent),1);
 const refill=active(s).find(x=>x.courtId===m.courtId)!,players=[...refill.a,...refill.b];
 assert.ok(!players.includes(absent),'the absent player is not scheduled again');
 for(const id of bench)assert.ok(players.includes(id),'waiting player '+id+' goes on court first');
});

test('absent players stay out of the rotation until they confirm they have arrived',async()=>{
 const {s,e,owner}=fixture();await apply(s,owner,'liveStart',{eventId:e.id},now);
 const m=active(s)[0],absent=m.b[1];
 await apply(s,owner,'noShow',{matchId:m.id,playerIds:[absent]},now+60000);
 assert.ok(!livePresentIds(s,e,now+60000).includes(absent));assert.deepEqual(e.noShowHold,[absent]);
 await assert.rejects(()=>apply(s,account(s,'p09'===absent?'p08':'p09'),'noShowArrived',{eventId:e.id,playerId:absent},now+90000),/403/);
 await apply(s,account(s,absent),'noShowArrived',{eventId:e.id,playerId:absent},now+120000);
 assert.equal(e.noShowHold,undefined);assert.ok(livePresentIds(s,e,now+120000).includes(absent));
});

test('only managers or present players of the same match can report, and only after the start and before a score',async()=>{
 const {s,e,owner}=fixture();await apply(s,owner,'liveStart',{eventId:e.id},now);
 const m=active(s).find(x=>!x.a.includes('p00')&&!x.b.includes('p00'))??active(s)[0],other=active(s).find(x=>x.id!==m.id)!,outsider=[...other.a,...other.b].find(id=>id!=='p00')!,absent=[...m.a,...m.b].find(id=>id!=='p00')!,before=structuredClone(s);
 await assert.rejects(()=>apply(s,account(s,outsider),'noShow',{matchId:m.id,playerIds:[absent]},now+60000),/403/);
 await assert.rejects(()=>apply(s,account(s,absent),'noShow',{matchId:m.id,playerIds:[absent]},now+60000),/403/,'the absent player cannot report themselves');
 await assert.rejects(()=>apply(s,owner,'noShow',{matchId:m.id,playerIds:[...m.a,...m.b]},now+60000),/至少要有一位/);
 await assert.rejects(()=>apply(s,owner,'noShow',{matchId:m.id,playerIds:[outsider]},now+60000),/本场比赛的选手/);
 assert.deepEqual(s,before);
 await apply(s,account(s,m.b[0]),'score',{matchId:m.id,a:21,b:15,reason:'本局结束'},now+60000);
 await assert.rejects(()=>apply(s,owner,'noShow',{matchId:m.id,playerIds:[absent]},now+90000),/录入比分前/);
});

test('both absent players of a team each lose once against the other team; a plain forfeit still rates nobody',async()=>{
 const {s,e,owner}=fixture();await apply(s,owner,'liveStart',{eventId:e.id},now);
 const [m,n]=active(s);
 await apply(s,owner,'noShow',{matchId:m.id,playerIds:[...m.a]},now+60000);
 await apply(s,owner,'void',{matchId:n.id,status:'forfeit',reason:'整场弃权'},now+60000);
 const ledger=realmLedger(s,now+120000);
 for(const id of m.a)assert.equal((ledger.byPlayer.get(id)??[]).filter(g=>!g.won).length,1);
 for(const id of [...m.b,...n.a,...n.b])assert.equal((ledger.byPlayer.get(id)??[]).length,0);
});
