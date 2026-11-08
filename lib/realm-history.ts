import {isRatedMatch,realmPolicy,replayRealmScores,type RealmChange} from './domain/realm-rating';
import {settledMatchFilter} from './domain/event-lifecycle';
import {pointGrants} from './domain/point-grants';
import {canRecoverEvent} from './domain/event-privacy';
import {maskClubContent} from './domain/blocked-words';
import {guestIds} from './domain/guests';
import type {Account,State} from './domain/types';

export type RealmHistoryEntry={id:string;kind:RealmChange['kind'];at:number;before:number;after:number;delta:number;title:string;pending:boolean;reason?:string;eventId?:string;gameIndex?:number;won?:boolean;k?:number;expected?:number;team?:number;opponent?:number};

/** One pair of full-club replays, indexed once for all players; never replay once per player or per row. */
export function buildRealmHistory(s:State,now:number){
 const grants=pointGrants(s).filter(g=>g.rating!==0).sort((a,b)=>a.at-b.at);
 const adjustments=grants.map(g=>({playerId:g.playerId,at:g.at,delta:g.rating})),settled=settledMatchFilter(s,now);
 const replay=(includePending:boolean)=>{
  const byPlayer=new Map<string,RealmChange[]>();
  const result=replayRealmScores(s,m=>isRatedMatch(m,now)&&(includePending||settled(m)),settled,realmPolicy.doubles,now,adjustments,change=>{
   const rows=byPlayer.get(change.playerId);if(rows)rows.push(change);else byPlayer.set(change.playerId,[change]);
  });
  return {byPlayer,scores:new Map([...result.rows].map(([id,row])=>[id,row.score]))};
 };
 return {at:now,grants,settled:replay(false),live:replay(true)};
}

export function realmHistoryView(s:State,a:Account,playerId:string,history:ReturnType<typeof buildRealmHistory>){
 const events=new Map(s.events.map(e=>[e.id,e]));
 const entries=(rows:RealmChange[])=>rows.map((row,index):RealmHistoryEntry=>{
  const base={id:String(index),kind:row.kind,at:row.at,before:row.before,after:row.after,delta:row.delta};
  if(row.kind==='reset')return {...base,title:'连续 3 个月未打计分局，修为重新定级',pending:false};
  if(row.kind==='adjustment')return {...base,title:'宗主手动调整修为',reason:a.role==='admin'||a.playerId===playerId?history.grants[row.adjustmentIndex!]?.reason??'':'',pending:false};
  const game=row.game!,event=events.get(game.eventId);
  const visible=!event||(event.status!=='draft'||event.creatorId===a.id||a.role==='admin')&&(event.deletedAt===undefined||canRecoverEvent(s,a,event));
  if(!visible)return {...base,title:'历史计分小局',pending:!game.settled};
  return {...base,title:event?.title??'历史计分对局',pending:!game.settled,eventId:event?.deletedAt===undefined&&event?event.id:undefined,
   gameIndex:game.gameIndex,won:game.won,k:game.k,expected:game.expected,team:game.team,opponent:game.opponent};
 }).reverse();
 const fixed=guestIds(s).has(playerId),score=history.settled.scores.get(playerId)??realmPolicy.start,liveScore=history.live.scores.get(playerId)??score;
 return maskClubContent({accountId:a.id,playerId,at:history.at,initial:fixed?score:realmPolicy.start,score,liveScore,pendingChange:liveScore-score,fixed,
  settled:entries(history.settled.byPlayer.get(playerId)??[]),live:entries(history.live.byPlayer.get(playerId)??[])},s.settings.blockedWords??[]);
}
export type RealmHistoryView=ReturnType<typeof realmHistoryView>;
