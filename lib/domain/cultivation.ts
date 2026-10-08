import type {State} from './types';
import {gameFacts} from './game-facts';
import {settledMatchFilter} from './event-lifecycle';
export const cultivationRealms=[
 {name:'炼气',minimum:0,range:'0–59 修为'},
 {name:'筑基',minimum:60,range:'60–179 修为'},
 {name:'金丹',minimum:180,range:'180–399 修为'},
 {name:'元婴',minimum:400,range:'400–799 修为'},
 {name:'化神',minimum:800,range:'800 修为及以上'},
] as const;
export const cultivationPolicy={win:10,loss:3,dayBonus:10,dailyGameCap:12} as const;
const nonnegative=(n:number)=>Number.isFinite(n)?Math.max(0,Math.floor(n)):0;
export function cultivationRealm(experience:number){const xp=nonnegative(experience);return [...cultivationRealms].reverse().find(r=>xp>=r.minimum)!.name}
export function cultivationProgress(experience:number){const xp=nonnegative(experience),realm=cultivationRealm(xp),index=cultivationRealms.findIndex(r=>r.name===realm),next=cultivationRealms[index+1];const progressPercent=next?Math.min(99,Math.floor((xp-cultivationRealms[index].minimum)/(next.minimum-cultivationRealms[index].minimum)*100)):100;return {realm,nextRealm:next?.name??null,stage:next?(progressPercent<34?'初期':progressPercent<67?'中期':'后期'):'圆满',progressPercent,experience:xp,nextAt:next?.minimum??null,remaining:next?next.minimum-xp:0}}
const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'});
/** Realms settle per activity: results wait while their activity is in progress,
 * then replay in completion order, so the settled outcome never depends on timing. */
export function cultivationSnapshot(s:State,now=Date.now()){
 const earned=new Map(s.players.map(p=>[p.id,{experience:0,wins:0,losses:0,creditedGames:0,trainingDays:0,pendingGames:0}])),counts=new Map<string,number>(),seen=new Set<string>(),settled=settledMatchFilter(s,now);
 for(const m of [...s.matches].sort((a,b)=>(a.end??Infinity)-(b.end??Infinity)||a.id.localeCompare(b.id))){if(seen.has(m.id)||!m.monthly||m.end===null||m.end>now||!Number.isFinite(m.end)||m.handicap?.applied)continue;seen.add(m.id);
  if(!settled(m)){const games=gameFacts(m).length;for(const id of new Set([...m.a,...m.b])){const row=earned.get(id);if(row)row.pendingGames+=games}continue}
  const date=day.format(m.end);
  for(const g of gameFacts(m))for(const id of new Set([...m.a,...m.b])){const row=earned.get(id);if(!row)continue;const key=id+':'+date,count=counts.get(key)??0;if(count>=cultivationPolicy.dailyGameCap)continue;const win=m[g.winner].includes(id);if(!count){row.experience+=cultivationPolicy.dayBonus;row.trainingDays++}row.experience+=win?cultivationPolicy.win:cultivationPolicy.loss;row.wins+=win?1:0;row.losses+=win?0:1;row.creditedGames++;counts.set(key,count+1);}
 }
 return new Map(s.players.map(p=>{const row=earned.get(p.id)!,base=nonnegative(p.cultivationBase??0),experience=row.experience+base;return [p.id,{...cultivationProgress(experience),base,earned:row.experience,wins:row.wins,losses:row.losses,creditedGames:row.creditedGames,trainingDays:row.trainingDays,pendingGames:row.pendingGames}]}));
}
export function playerCultivation(s:State,id:string,now=Date.now()){return cultivationSnapshot(s,now).get(id)!}
/** Freeze only the difference needed to preserve the old visible realm. */
export function enableWeeklyProgression(s:State,now=Date.now()){
 if(!s.settings.initialized||s.settings.progressionVersion==='weekly-v2')return false;
 const earned=cultivationSnapshot(s,now),legacy=[-Infinity,1100,1232,1300,1380];
 for(const p of s.players){if(p.cultivationBase!==undefined)continue;const index=Math.max(0,legacy.findLastIndex(min=>p.rating>=min));p.cultivationBase=Math.max(0,cultivationRealms[index].minimum-earned.get(p.id)!.earned)}
 const upgrade=(rules:State['settings']['rules'])=>{if(rules.win===3&&rules.loss===0&&(rules.cap===12||rules.cap===0)){rules.win=10;rules.loss=3;rules.cap=0;return true}return false};
 upgrade(s.settings.rules);for(const season of s.seasons)if(upgrade(season.rules))season.version=(season.version??1)+1;
 s.settings.progressionVersion='weekly-v2';return true;
}
/** This remains a strength description for matching, not the growth realm. */
export function strengthTier(rating:number){return rating<1100?'入门':rating<1232?'基础':rating<1300?'熟练':rating<1380?'进阶':'高手'}
