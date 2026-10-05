import {achievementCatalog,type AchievementMetric,type AchievementSummary} from '../achievement-catalog';
import {winner} from './social';
import type {State,Match} from './types';

function validResult(m:Match,now:number){
 return m.status==='complete'&&m.start!==null&&m.end!==null&&
  Number.isFinite(m.start)&&Number.isFinite(m.end)&&m.start>=0&&m.start<=m.end&&m.end<=now&&
  m.scoreA!==null&&m.scoreB!==null&&Number.isFinite(m.scoreA)&&Number.isFinite(m.scoreB)&&
  m.scoreA>=0&&m.scoreB>=0&&m.scoreA!==m.scoreB&&Array.isArray(m.a)&&Array.isArray(m.b)&&m.a.length===2&&m.b.length===2&&
  new Set([...m.a,...m.b]).size===4;
}

/** Derive lifetime achievements from authorized, completed facts in one pass.
 * No new tables or client-supplied award writes. Corrected/voided facts recalculate. */
export function achievementSnapshot(s:State,now=Date.now()):Record<string,AchievementSummary>{
 const eventIds=new Set(s.events.map(e=>e.id)),players=new Set(s.players.map(p=>p.id));
 const totals=new Map<string,{metrics:Record<AchievementMetric,number>;streak:number;partners:Set<string>;summary:AchievementSummary}>();
 for(const p of s.players)totals.set(p.id,{
  metrics:{matches:0,wins:0,bestStreak:0,partners:0,threeGameWins:0},streak:0,partners:new Set(),
  summary:{unlockedCount:0,progress:Object.fromEntries(achievementCatalog.map(a=>[a.id,{current:0,unlockedAt:null}])) as AchievementSummary['progress']},
 });
 const seen=new Set<string>();
 const matches=s.matches.filter(m=>eventIds.has(m.eventId)&&validResult(m,now)).sort((a,b)=>a.end!-b.end!||a.id.localeCompare(b.id));
 for(const m of matches){
  if(seen.has(m.id))continue;seen.add(m.id);
  const winning=winner(m);
  for(const side of ['a','b'] as const)for(const id of m[side]){
   const row=totals.get(id);if(!row)continue;
   row.metrics.matches++;
   for(const partner of m[side])if(partner!==id&&players.has(partner))row.partners.add(partner);
   row.metrics.partners=row.partners.size;
   if(side===winning){
    row.metrics.wins++;row.streak++;row.metrics.bestStreak=Math.max(row.metrics.bestStreak,row.streak);
    if(m.games?.length===3)row.metrics.threeGameWins++;
   }else row.streak=0;
   for(const a of achievementCatalog){
    const progress=row.summary.progress[a.id];progress.current=row.metrics[a.metric];
    if(progress.unlockedAt===null&&progress.current>=a.target){progress.unlockedAt=m.end;row.summary.unlockedCount++}
   }
  }
 }
 return Object.fromEntries([...totals].map(([id,row])=>[id,row.summary]));
}
