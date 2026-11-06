import {eventGamePoints} from './game-points';
import {z} from 'zod';
import {eventRankingEnabled} from './event-ranking';
import {eventFormat} from './match-format';
import {gameFacts} from './game-facts';
import {isGuest} from './guests';
import {isClubOwner} from './ownership';
import {fail,month,type Account,type Event,type State} from './types';
import {realmLedger,type RatedGame} from './realm-rating';
import {upsetOfferEligible} from './bounty-opportunities';

/** Bounties (docs/BOUNTIES.md): before a points match some members are offered one challenge about how they play in
 * the games the scheduler gives them. Accepting risks a point penalty; declining costs nothing. */
export type BountyKind='streak'|'rout'|'upset'|'deuce'|'unbeaten'|'champion'|'sweep'|'close';
export type BountyReward={coins:number;points:number};
export type BountySettings={rewards:Record<BountyKind,BountyReward>;penalty:number};
/** A member's answer, with the reward and penalty frozen when they accepted. */
export type BountyRecord={playerId:string;kind:BountyKind;status:'accepted'|'declined';at:number;coins:number;points:number;penalty:number;/** A 15-point activity (lib/domain/game-points.ts), whose rout and deuce thresholds are lower. */gamePoints?:15};
export type BountyOutcome='completed'|'failed'|'void';

export const bountyKinds:BountyKind[]=['streak','rout','upset','deuce','unbeaten','champion','sweep','close'];
/** Chance that each eligible member, drawn independently, is offered a bounty; how early, and the thresholds of each challenge. */
export const bountyChance=0.3,bountyOfferMinutes=30,bountyStreakWins=5,bountyRoutMaxScore=9,bountyUpsetGap=250,bountyDeuceScore=20,
 bountyUnbeatenGames=4,bountyChampionWins=3,bountySweepOpponents={doubles:5,singles:3},bountyCloseWins=2;
export const defaultBountySettings:BountySettings={rewards:{streak:{coins:30,points:15},upset:{coins:20,points:10},rout:{coins:15,points:8},deuce:{coins:10,points:6},
 unbeaten:{coins:25,points:12},sweep:{coins:18,points:9},champion:{coins:20,points:10},close:{coins:12,points:6}},penalty:10};
export const bountyTitles:Record<BountyKind,string>={streak:'连胜悬赏',rout:'大胜悬赏',upset:'以弱胜强悬赏',deuce:'鏖战悬赏',unbeaten:'金身悬赏',champion:'夺魁悬赏',sweep:'横扫悬赏',close:'险胜悬赏'};
/** In a 15-point game: a rout leaves the opponents at most 5, a deuce game is won after 14:14. */
export const bountyRoutMaxScore15=5,bountyDeuceScore15=14;
export const bountyGoals:Record<BountyKind,string>={
 streak:`本场活动连赢 ${bountyStreakWins} 局`,
 rout:`赢一局，且对手只得个位数分（不超过 ${bountyRoutMaxScore} 分）`,
 upset:`赢一局比赛，对手中至少一人的修为比你方平均高 ${bountyUpsetGap} 以上`,
 deuce:`赢一局 ${bountyDeuceScore} 平后的加分赛（如 22:20）`,
 unbeaten:`本场活动一局不输，金身不破（至少打满 ${bountyUnbeatenGames} 局）`,
 champion:`本场活动赢的局数力压全场，独占鳌头（并列第一也算，至少赢 ${bountyChampionWins} 局）`,
 sweep:`本场活动击败至少 ${bountySweepOpponents.doubles} 位不同对手（单打 ${bountySweepOpponents.singles} 位），横扫八方`,
 close:`赢下至少 ${bountyCloseWins} 局只领先 2 分的比赛（如 21:19），刀尖问道`,
};
/** The goal as the member reads it, with the thresholds of a 15-point activity. */
export function bountyGoal(kind:BountyKind,gamePoints?:15|21){
 if(gamePoints!==15)return bountyGoals[kind];
 if(kind==='rout')return `赢一局，且对手不超过 ${bountyRoutMaxScore15} 分（15 分制）`;
 if(kind==='deuce')return `赢一局 ${bountyDeuceScore15} 平后的加分赛（如 16:14，15 分制）`;
 return bountyGoals[kind];
}
export function bountySettings(s:Pick<State,'settings'>):BountySettings{
 const saved=s.settings.bounty;
 return {penalty:saved?.penalty??defaultBountySettings.penalty,rewards:Object.fromEntries(bountyKinds.map(k=>[k,{...defaultBountySettings.rewards[k],...saved?.rewards?.[k]}])) as Record<BountyKind,BountyReward>};
}

/** FNV-1a: a stable draw per activity and member, so a refresh or another device shows the same offer. */
function hash(text:string){let h=0x811c9dc5;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0}return h}
export function drawnBounty(eventId:string,playerId:string):BountyKind|null{
 if(hash(eventId+'|'+playerId+'|bounty-offer')%1000>=bountyChance*1000)return null;
 return bountyKinds[hash(eventId+'|'+playerId+'|bounty-kind')%bountyKinds.length];
}
export const bountyOfferAt=(e:Pick<Event,'start'>)=>e.start-bountyOfferMinutes*60000;
/** Points matches only: ranked, not tournaments, not draft, cancelled or deleted. */
export function bountyEvent(e:Event){return e.deletedAt===undefined&&eventRankingEnabled(e)&&!e.tournament&&!['draft','cancelled'].includes(e.status)}

type OfferState=Pick<State,'registrations'|'matches'|'players'|'accounts'|'settings'>;
/** The offer this member can still answer: from 30 minutes before the start until their first game of the activity
 * starts, so nobody accepts after seeing how they play. A confirmed, non-guest member; one answer per activity. */
export function bountyOffer(s:OfferState,e:Event,playerId:string,now:number,upsetEligible:()=>boolean=()=>false){
 if(!bountyEvent(e)||now<bountyOfferAt(e)||now>=e.end)return null;
 if(e.bounties?.some(b=>b.playerId===playerId))return null;
 if(!s.registrations.some(r=>r.eventId===e.id&&r.playerId===playerId&&r.status==='confirmed')||isGuest(s as State,playerId))return null;
 if(s.matches.some(m=>m.eventId===e.id&&m.start!==null&&m.start<=now&&[...m.a,...m.b].includes(playerId)))return null;
 const kind=drawnBounty(e.id,playerId);if(!kind)return null;
 if(kind==='upset'&&!upsetEligible())return null;
 const {rewards,penalty}=bountySettings(s);
 return {eventId:e.id,playerId,kind,...rewards[kind],penalty,...(eventGamePoints(e)===15?{gamePoints:15 as const}:{})};
}

export const bountyRespondInput=z.object({eventId:z.string().min(1).max(100),playerId:z.string().min(1).max(100),accept:z.boolean()}).strict();
/** A member answers their own offer. The answer is final; the reward and penalty are frozen with it. */
export function respondBounty(s:State,a:Account,input:unknown,now:number){
 const c=bountyRespondInput.parse(input);
 if(c.playerId!==a.playerId)fail('403: 只能回应自己的悬赏令');
 const e=s.events.find(e=>e.id===c.eventId)??fail('活动不存在');
 const existing=e.bounties?.find(b=>b.playerId===c.playerId);
 if(existing){if((existing.status==='accepted')===c.accept)return existing;fail('悬赏令已经回应过，不能更改')}
 const offer=bountyOffer(s,e,c.playerId,now,()=>upsetOfferEligible(s,e,c.playerId,now,realmLedger(s,now).snapshot,bountyUpsetGap))??fail('这张悬赏令已经失效，或当前排场没有符合条件的挑战机会');
 const record:BountyRecord={playerId:c.playerId,kind:offer.kind,status:c.accept?'accepted':'declined',at:now,coins:offer.coins,points:offer.points,penalty:offer.penalty,...(offer.gamePoints?{gamePoints:offer.gamePoints}:{})};
 (e.bounties??=[]).push(record);
 return record;
}

const rewardInput=z.object({coins:z.number().int().min(0).max(1000),points:z.number().int().min(0).max(100)}).strict();
export const bountySettingsInput=z.object({rewards:z.object(Object.fromEntries(bountyKinds.map(k=>[k,rewardInput])) as Record<BountyKind,typeof rewardInput>).strict(),penalty:z.number().int().min(0).max(100)}).strict();
/** The owner and administrators set the rewards and the penalty; answers already given keep theirs. */
export function updateBountySettings(s:State,a:Account,input:unknown,now:number){
 if(!isClubOwner(s,a)&&a.role!=='admin')fail('403: 只有宗主和副宗主可以调整悬赏令');
 const c=bountySettingsInput.parse(input),before=bountySettings(s);
 s.settings.bounty=c;
 s.audits.push({id:crypto.randomUUID(),at:now,actor:a.id,action:'bountySettings',reason:'调整悬赏令奖励与惩罚',changes:{before,after:c}});
}

/** Whether an accepted bounty was met, once the activity's scheduled end has passed. Only completed games count; a
 * no-show forfeit is not a game. The upset compares each opponent's 修为 before the match with the average of the
 * member's side; gamesOf gives every player's rated games (the realm ledger). */
export function bountyOutcome(s:Pick<State,'matches'>,e:Event,record:BountyRecord,now:number,gamesOf?:(playerId:string)=>RatedGame[]):BountyOutcome|null{
 if(record.status!=='accepted'||!bountyEvent(e)||now<e.end)return null;
 const id=record.playerId,played=s.matches.filter(m=>m.eventId===e.id&&[...m.a,...m.b].includes(id)).flatMap(m=>gameFacts(m).map(g=>({...g,side:m.a.includes(id)?'a' as const:'b' as const})))
  .sort((x,y)=>x.match.start!-y.match.start!||x.match.id.localeCompare(y.match.id)||x.index-y.index);
 const won=played.filter(g=>g.winner===g.side),loserScore=(g:typeof played[number])=>g.side==='a'?g.b:g.a;
 let met=false;const fifteen=eventGamePoints(e)===15;
 if(record.kind==='streak'){let run=0;for(const g of played){run=g.winner===g.side?run+1:0;if(run>=bountyStreakWins)met=true}}
 else if(record.kind==='rout')met=won.some(g=>loserScore(g)<=(fifteen?bountyRoutMaxScore15:bountyRoutMaxScore));
 else if(record.kind==='deuce')met=won.some(g=>loserScore(g)>=(fifteen?bountyDeuceScore15:bountyDeuceScore));
 else if(record.kind==='unbeaten')met=played.length>=bountyUnbeatenGames&&won.length===played.length;
 else if(record.kind==='champion'){
  // Games won by everyone at the activity; the bounty holder must have the most (a tie for first counts).
  const wins=new Map<string,number>();
  for(const m of s.matches)if(m.eventId===e.id)for(const g of gameFacts(m))for(const pid of m[g.winner])wins.set(pid,(wins.get(pid)??0)+1);
  met=won.length>=bountyChampionWins&&won.length>=Math.max(0,...wins.values());
 }
 else if(record.kind==='sweep')met=new Set(won.flatMap(g=>g.match[g.side==='a'?'b':'a'])).size>=bountySweepOpponents[eventFormat(e)==='singles'?'singles':'doubles'];
 else if(record.kind==='close')met=won.filter(g=>Math.abs(g.a-g.b)===2).length>=bountyCloseWins;
 else{
  // The upset: a won game where at least one opponent's 修为 before the match was at least bountyUpsetGap above the
  // average of the member's side. A missing opponent record falls back to the opponents' average.
  const matches=new Map(played.map(g=>[g.match.id,g.match])),mine=gamesOf?.(id)??[],opponents=new Map<string,Map<string,number>>();
  let opportunity=false;
  for(const g of mine){
   const m=matches.get(g.matchId);if(g.eventId!==e.id||!m||g.end>now)continue;
   const before=m[g.side==='a'?'b':'a'].map(pid=>{
    let rows=opponents.get(pid);if(!rows){rows=new Map((gamesOf?.(pid)??[]).map(x=>[JSON.stringify([x.matchId,x.gameIndex]),x.before]));opponents.set(pid,rows)}
    return rows.get(JSON.stringify([g.matchId,g.gameIndex]));
   }).filter((x):x is number=>x!==undefined);
   // A guest has no rated row: recover their fixed score from the recorded doubles average.
   if(before.length===1&&m[g.side==='a'?'b':'a'].length===2)before.push(2*g.opponent-before[0]);
   if(Math.max(g.opponent,...before)-g.team>=bountyUpsetGap){opportunity=true;if(g.won)met=true}
  }
  if(!opportunity)return 'void';
 }
 return met?'completed':'failed';
}
/** Season points from bounties, on the activity's singles or doubles board in the month it started: the frozen reward
 * for a completed bounty, minus the frozen penalty for an accepted one that was not met. */
export function bountyPointAdjustments(s:Pick<State,'events'|'matches'>,now:number,gamesOf:(playerId:string)=>RatedGame[]){
 return s.events.filter(bountyEvent).flatMap(e=>(e.bounties??[]).flatMap(b=>{
  const outcome=bountyOutcome(s,e,b,now,gamesOf),delta=outcome==='completed'?b.points:outcome==='failed'?-b.penalty:0;
  return delta?[{playerId:b.playerId,eventId:e.id,period:month(e.start),format:eventFormat(e) as 'singles'|'doubles',delta}]:[];
 }));
}

/** How long the whole club hears of a completed bounty after its activity ends; the member's own card on the home
 * page stays as long (app/bounty-card.tsx). */
export const bountyHonorHours=24;
export const bountyHonorUntil=(e:Pick<Event,'end'>)=>e.end+bountyHonorHours*3600000;
export type BountyHonor={eventId:string;title:string;playerId:string;kind:BountyKind;coins:number;points:number;at:number};
/** Completed bounties of activities that ended in the last day, newest first, announced to everyone. Only completions
 * are public; declined, open and failed bounties stay private. */
export function bountyHonors(s:Pick<State,'events'|'matches'>,now:number,gamesOf:(playerId:string)=>RatedGame[]):BountyHonor[]{
 return s.events.filter(e=>bountyEvent(e)&&e.end<=now&&now<bountyHonorUntil(e)&&e.bounties?.length).flatMap(e=>e.bounties!.filter(b=>b.status==='accepted'&&bountyOutcome(s,e,b,now,gamesOf)==='completed')
  .map(b=>({eventId:e.id,title:e.title,playerId:b.playerId,kind:b.kind,coins:b.coins,points:b.points,at:e.end})))
  .sort((a,b)=>b.at-a.at||a.eventId.localeCompare(b.eventId)||a.playerId.localeCompare(b.playerId));
}

/** Command entry: true when the action was a bounty command. */
export function applyBounty(s:State,a:Account,action:string,input:unknown,now:number){
 if(action==='bountyRespond'){respondBounty(s,a,input,now);return true}
 if(action==='bountySettings'){updateBountySettings(s,a,input,now);return true}
 return false;
}
