import {achievementCatalog,achievementTargets,type AchievementMetric,type AchievementSummary} from '../achievement-catalog';
import {winner} from './social';
import type {State,Match} from './types';

const dateFormatter=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'});

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
 const totals=new Map<string,{metrics:Record<AchievementMetric,number>;streak:number;partners:Set<string>;opponents:Set<string>;days:Set<string>;partnerWins:Map<string,number>;bestPartnerId?:string;summary:AchievementSummary}>();
 for(const p of s.players)totals.set(p.id,{
  metrics:{matches:0,wins:0,bestStreak:0,partners:0,threeGameWins:0,opponentsBeaten:0,matchDays:0,partnerWins:0},streak:0,partners:new Set(),opponents:new Set(),days:new Set(),partnerWins:new Map(),
  summary:{unlockedCount:0,totalLevels:0,progress:Object.fromEntries(achievementCatalog.map(a=>[a.id,{current:0,unlockedAt:null,level:0,levelUnlockedAt:[null,null,null,null,null]}])) as AchievementSummary['progress']},
 });
 const seen=new Set<string>();
 const matches=s.matches.filter(m=>eventIds.has(m.eventId)&&validResult(m,now)).sort((a,b)=>a.end!-b.end!||a.id.localeCompare(b.id));
 for(const m of matches){
  if(seen.has(m.id))continue;seen.add(m.id);
  const winning=winner(m);
  const day=dateFormatter.format(m.end!);
  for(const side of ['a','b'] as const)for(const id of m[side]){
   const row=totals.get(id);if(!row)continue;
   row.metrics.matches++;
   row.days.add(day);row.metrics.matchDays=row.days.size;
   for(const partner of m[side])if(partner!==id&&players.has(partner))row.partners.add(partner);
   row.metrics.partners=row.partners.size;
   if(side===winning){
    row.metrics.wins++;row.streak++;row.metrics.bestStreak=Math.max(row.metrics.bestStreak,row.streak);
    for(const opponent of m[side==='a'?'b':'a'])if(players.has(opponent))row.opponents.add(opponent);
    row.metrics.opponentsBeaten=row.opponents.size;
    for(const partner of m[side])if(partner!==id&&players.has(partner)){
     const wins=(row.partnerWins.get(partner)??0)+1;row.partnerWins.set(partner,wins);
     if(wins>row.metrics.partnerWins){row.metrics.partnerWins=wins;row.bestPartnerId=partner}
    }
    if(m.games?.length===3)row.metrics.threeGameWins++;
   }else row.streak=0;
   for(const a of achievementCatalog){
    const progress=row.summary.progress[a.id];progress.current=row.metrics[a.metric];
    if(a.metric==='partnerWins'&&row.bestPartnerId)progress.partnerId=row.bestPartnerId;
    for(const [index,target]of achievementTargets[a.id].entries())if(progress.levelUnlockedAt[index]===null&&progress.current>=target){
     progress.levelUnlockedAt[index]=m.end;progress.level++;row.summary.totalLevels++;
     if(index===0){progress.unlockedAt=m.end;row.summary.unlockedCount++}
    }
   }
  }
 }
 return Object.fromEntries([...totals].map(([id,row])=>[id,row.summary]));
}
