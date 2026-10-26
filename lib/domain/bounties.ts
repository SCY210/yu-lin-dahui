import {z} from 'zod';
import {eventRankingEnabled} from './event-ranking';
import {eventFormat} from './match-format';
import {gameFacts} from './game-facts';
import {isGuest} from './guests';
import {isClubOwner} from './ownership';
import {fail,month,type Account,type Event,type State} from './types';
import type {RatedGame} from './realm-rating';

/** Bounties (docs/BOUNTIES.md): before a points match some members are offered one challenge about how they play in
 * the games the scheduler gives them. Accepting risks a point penalty; declining costs nothing. */
export type BountyKind='streak'|'rout'|'upset'|'deuce';
export type BountyReward={coins:number;points:number};
export type BountySettings={rewards:Record<BountyKind,BountyReward>;penalty:number};
/** A member's answer, with the reward and penalty frozen when they accepted. */
export type BountyRecord={playerId:string;kind:BountyKind;status:'accepted'|'declined';at:number;coins:number;points:number;penalty:number};
export type BountyOutcome='completed'|'failed';

export const bountyKinds:BountyKind[]=['streak','rout','upset','deuce'];
/** Share of eligible members offered a bounty, how early, and the thresholds of each challenge. */
export const bountyChance=0.6,bountyOfferMinutes=30,bountyStreakWins=5,bountyRoutMaxScore=9,bountyUpsetGap=250,bountyDeuceScore=20;
export const defaultBountySettings:BountySettings={rewards:{streak:{coins:30,points:15},upset:{coins:20,points:10},rout:{coins:15,points:8},deuce:{coins:10,points:6}},penalty:10};
export const bountyTitles:Record<BountyKind,string>={streak:'连胜悬赏',rout:'大胜悬赏',upset:'以弱胜强悬赏',deuce:'鏖战悬赏'};
export const bountyGoals:Record<BountyKind,string>={
 streak:`本场活动连赢 ${bountyStreakWins} 局`,
 rout:`赢一局，且对手只得个位数分（不超过 ${bountyRoutMaxScore} 分）`,
 upset:`赢一局对手平均修为比你方高至少 ${bountyUpsetGap} 的比赛`,
 deuce:`赢一局 ${bountyDeuceScore} 平后的加分赛（如 22:20）`,
};
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
export function bountyOffer(s:OfferState,e:Event,playerId:string,now:number){
 if(!bountyEvent(e)||now<bountyOfferAt(e)||now>=e.end)return null;
 if(e.bounties?.some(b=>b.playerId===playerId))return null;
 if(!s.registrations.some(r=>r.eventId===e.id&&r.playerId===playerId&&r.status==='confirmed')||isGuest(s as State,playerId))return null;
 if(s.matches.some(m=>m.eventId===e.id&&m.start!==null&&m.start<=now&&[...m.a,...m.b].includes(playerId)))return null;
 const kind=drawnBounty(e.id,playerId);if(!kind)return null;
 const {rewards,penalty}=bountySettings(s);
 return {eventId:e.id,playerId,kind,...rewards[kind],penalty};
}

export const bountyRespondInput=z.object({eventId:z.string().min(1).max(100),playerId:z.string().min(1).max(100),accept:z.boolean()}).strict();
/** A member answers their own offer. The answer is final; the reward and penalty are frozen with it. */
export function respondBounty(s:State,a:Account,input:unknown,now:number){
 const c=bountyRespondInput.parse(input);
 if(c.playerId!==a.playerId)fail('403: 只能回应自己的悬赏令');
 const e=s.events.find(e=>e.id===c.eventId)??fail('活动不存在');
 const existing=e.bounties?.find(b=>b.playerId===c.playerId);
 if(existing){if((existing.status==='accepted')===c.accept)return existing;fail('悬赏令已经回应过，不能更改')}
 const offer=bountyOffer(s,e,c.playerId,now)??fail('这张悬赏令已经失效');
 const record:BountyRecord={playerId:c.playerId,kind:offer.kind,status:c.accept?'accepted':'declined',at:now,coins:offer.coins,points:offer.points,penalty:offer.penalty};
 (e.bounties??=[]).push(record);
 return record;
}

const rewardInput=z.object({coins:z.number().int().min(0).max(1000),points:z.number().int().min(0).max(100)}).strict();
export const bountySettingsInput=z.object({rewards:z.object({streak:rewardInput,rout:rewardInput,upset:rewardInput,deuce:rewardInput}).strict(),penalty:z.number().int().min(0).max(100)}).strict();
/** The owner and administrators set the rewards and the penalty; answers already given keep theirs. */
export function updateBountySettings(s:State,a:Account,input:unknown,now:number){
 if(!isClubOwner(s,a)&&a.role!=='admin')fail('403: 只有群主和管理员可以调整悬赏令');
 const c=bountySettingsInput.parse(input),before=bountySettings(s);
 s.settings.bounty=c;
 s.audits.push({id:crypto.randomUUID(),at:now,actor:a.id,action:'bountySettings',reason:'调整悬赏令奖励与惩罚',changes:{before,after:c}});
}

/** Whether an accepted bounty was met, once the activity's scheduled end has passed. Only completed games count; a
 * no-show forfeit is not a game. The upset compares the average 修为 of both sides before the match. */
export function bountyOutcome(s:Pick<State,'matches'>,e:Event,record:BountyRecord,now:number,games?:RatedGame[]):BountyOutcome|null{
 if(record.status!=='accepted'||!bountyEvent(e)||now<e.end)return null;
 const id=record.playerId,played=s.matches.filter(m=>m.eventId===e.id&&[...m.a,...m.b].includes(id)).flatMap(m=>gameFacts(m).map(g=>({...g,side:m.a.includes(id)?'a' as const:'b' as const})))
  .sort((x,y)=>x.match.start!-y.match.start!||x.match.id.localeCompare(y.match.id)||x.index-y.index);
 const won=played.filter(g=>g.winner===g.side),loserScore=(g:typeof played[number])=>g.side==='a'?g.b:g.a;
 let met=false;
 if(record.kind==='streak'){let run=0;for(const g of played){run=g.winner===g.side?run+1:0;if(run>=bountyStreakWins)met=true}}
 else if(record.kind==='rout')met=won.some(g=>loserScore(g)<=bountyRoutMaxScore);
 else if(record.kind==='deuce')met=won.some(g=>loserScore(g)>=bountyDeuceScore);
 else met=(games??[]).some(g=>g.eventId===e.id&&g.playerId===id&&g.won&&g.opponent-g.team>=bountyUpsetGap);
 return met?'completed':'failed';
}
/** Season points from bounties, on the activity's singles or doubles board in the month it started: the frozen reward
 * for a completed bounty, minus the frozen penalty for an accepted one that was not met. */
export function bountyPointAdjustments(s:Pick<State,'events'|'matches'>,now:number,gamesOf:(playerId:string)=>RatedGame[]){
 return s.events.filter(bountyEvent).flatMap(e=>(e.bounties??[]).flatMap(b=>{
  const outcome=bountyOutcome(s,e,b,now,b.kind==='upset'?gamesOf(b.playerId):undefined),delta=outcome==='completed'?b.points:outcome==='failed'?-b.penalty:0;
  return delta?[{playerId:b.playerId,eventId:e.id,period:month(e.start),format:eventFormat(e) as 'singles'|'doubles',delta}]:[];
 }));
}

/** Command entry: true when the action was a bounty command. */
export function applyBounty(s:State,a:Account,action:string,input:unknown,now:number){
 if(action==='bountyRespond'){respondBounty(s,a,input,now);return true}
 if(action==='bountySettings'){updateBountySettings(s,a,input,now);return true}
 return false;
}
