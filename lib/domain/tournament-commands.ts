import {markRanked} from './all-ranked';
import {z} from 'zod';
import {parseDomainCommand} from './command-contract';
import {authorizeEventAction} from './permissions';
import {eventStatusAt} from './event-lifecycle';
import {teamSize,isPractice} from './match-format';
import {validateRound} from './grouping';
import {fail,month,type State,type Account,type Match} from './types';
import {fixtureSides,groupStandings,groupComplete,type TournamentFixture} from './tournament';
const id=z.string().min(1).max(100);
const schemas={
 tournamentDraw:z.object({eventId:id,teams:z.array(z.array(id).min(1).max(2)).min(4).max(32),groups:z.number().int().min(2).max(8),advance:z.number().int().min(1).max(4),seed:z.number().int().min(1).max(2147483647)}),
 tournamentKnockout:z.object({eventId:id}),tournamentReopen:z.object({eventId:id}),
 tournamentStart:z.object({eventId:id,fixtureId:id,courtId:id}),
};
export async function applyTournament(s:State,a:Account,action:string,input:unknown,now:number){
 const c=parseDomainCommand(schemas,action,input);if(!c)return false;
 const p=c.payload;authorizeEventAction(s,a,action,p);
 const e=s.events.find(e=>e.id===p.eventId)??fail('比赛不存在'),t=e.tournament??fail('此活动不是赛事');
 if(isPractice(e)||['draft','ended','cancelled'].includes(eventStatusAt(e,now)))fail('赛事尚未开放或已经结束');
 switch(c.action){
  case 'tournamentDraw':{
   const p=c.payload;
   if(s.matches.some(m=>m.eventId===e.id))fail('比赛已开打，不能重新抽签');
   const players=p.teams.flat(),size=teamSize(e);
   if(p.teams.some(team=>team.length!==size)||new Set(players).size!==players.length)fail('请检查队伍人数，每人只能参加一队');
   if(players.some(id=>!s.players.some(x=>x.id===id&&x.enabled)||!s.registrations.some(r=>r.eventId===e.id&&r.playerId===id&&r.status==='confirmed')))fail('只可选择本赛事正式报名的球友');
   if(p.groups*2>p.teams.length||p.advance>Math.floor(p.teams.length/p.groups))fail('每组至少两队，晋级名额不能超过最小组人数');
   let seed=p.seed>>>0;const shuffled=p.teams.map(players=>({id:crypto.randomUUID(),players}));
   for(let i=shuffled.length-1;i>0;i--){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const j=seed%(i+1);[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]]}
   const groups=Array.from({length:p.groups},()=>[] as string[]);shuffled.forEach((team,i)=>groups[i%p.groups].push(team.id));
   const fixtures:TournamentFixture[]=[];
   groups.forEach((group,g)=>{const ring:(string|null)[]=[...group];if(ring.length%2)ring.push(null);for(let r=0;r<ring.length-1;r++){for(let i=0;i<ring.length/2;i++){const a=ring[i],b=ring[ring.length-1-i];if(a&&b)fixtures.push({id:crypto.randomUUID(),stage:'group',group:g,round:r+1,slot:i,a,b})}ring.splice(1,0,ring.pop()!)}});
   e.tournament={phase:'groups',teams:shuffled,groups,advance:p.advance,fixtures};break;
  }
  case 'tournamentKnockout':{
   if(t.phase!=='groups'||!groupComplete(t,s))fail('请先完成所有小组赛');
   const tables=t.groups.map((_,i)=>groupStandings(t,s,i)),seeds:string[]=[];
   for(let rank=0;rank<t.advance;rank++)for(const table of tables)seeds.push(table[rank].id);
   let size=2;while(size<seeds.length)size*=2;
   const slots:(string|undefined)[]=Array.from({length:size},(_,i)=>seeds[i]);
   const first=Array.from({length:size/2},(_,i)=>({a:slots[i],b:slots[size-1-i]}));
   const groupOf=(id:string|undefined)=>t.groups.findIndex(g=>g.includes(id??''));
   for(let i=0;i<first.length;i++){const pair=first[i];if(!pair.a||!pair.b||groupOf(pair.a)!==groupOf(pair.b))continue;
    const j=first.findIndex((other,j)=>j!==i&&other.a&&other.b&&groupOf(pair.a)!==groupOf(other.b)&&groupOf(other.a)!==groupOf(pair.b));
    if(j>=0)[pair.b,first[j].b]=[first[j].b,pair.b];
   }
   let prior:TournamentFixture[]=[];
   for(let round=1,count=size/2;count>=1;round++,count/=2){const next:TournamentFixture[]=[];for(let slot=0;slot<count;slot++){
    const f:TournamentFixture={id:crypto.randomUUID(),stage:'knockout',round,slot,...(round===1?first[slot]:{fromA:prior[slot*2].id,fromB:prior[slot*2+1].id})};next.push(f);
   }t.fixtures.push(...next);prior=next}t.phase='knockout';break;
  }
  case 'tournamentReopen':{
   if(t.phase!=='knockout'||t.fixtures.some(f=>f.stage==='knockout'&&f.matchId))fail('淘汰赛已开打，不能返回小组赛');
   t.fixtures=t.fixtures.filter(f=>f.stage==='group');t.phase='groups';break;
  }
  case 'tournamentStart':{
   const p=c.payload,f=t.fixtures.find(f=>f.id===p.fixtureId)??fail('对阵不存在');
   if(f.matchId)fail('409: 这场比赛已开始，请刷新');
   if(f.stage==='group'&&t.phase!=='groups')fail('小组赛已封存');
   const sides=fixtureSides(t,s,f);if(!sides.a||!sides.b)fail('请等待前序赛果；轮空无需开赛');
   const ta=t.teams.find(x=>x.id===sides.a)!,tb=t.teams.find(x=>x.id===sides.b)!;
   const court=s.bookings.find(x=>x.id===p.courtId&&x.eventId===e.id)??fail('场地不存在');
   if(s.matches.some(m=>m.status==='playing'&&s.bookings.some(b=>b.id===m.courtId&&b.name===court.name&&(b.venue??s.events.find(x=>x.id===b.eventId)?.venue)===(court.venue??e.venue))))fail('这片场地正在比赛');
   if(now<e.start||now>=e.end||now<court.start||now>=court.end)fail('当前不在赛事或场地预约时间内');
   const roundId=crypto.randomUUID(),m:Match={id:crypto.randomUUID(),eventId:e.id,roundId,courtId:court.id,a:[...ta.players],b:[...tb.players],status:'playing',start:now,end:null,scoreA:null,scoreB:null,monthly:true,elo:true,locked:true,enteredBy:null,games:[]};
   validateRound(s,e.id,now,0,[m]);
   s.rounds.push({id:roundId,eventId:e.id,start:now,duration:0,status:'playing',eligible:[...m.a,...m.b],rest:[],seed:1});markRanked(m,e);s.matches.push(m);f.matchId=m.id;
   if(!s.seasons.some(x=>x.id===month(now)))s.seasons.push({id:month(now),rules:{...s.settings.rules},version:1});break;
  }
 }
 s.audits.push({id:crypto.randomUUID(),at:now,actor:a.id,action,reason:'赛事安排',changes:{eventId:e.id}});return true;
}
