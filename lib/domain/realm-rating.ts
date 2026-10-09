import type {Match,State} from './types';
import {gameFacts} from './game-facts';
import {settledMatchFilter} from './event-lifecycle';

/** 段位分 (FIDE-style Elo): everyone starts at 1000 and each rated game moves it. */
export const realmPolicy={start:1000,k:16,provisionalK:32,provisionalGames:20,placementGames:10,demotionBuffer:15,band:100,doubles:'individual'} as const;
/** individual: each player's own score against the opponents' average (the club's choice).
 * team: both partners share the expectation of their team average. */
export type DoublesExpectation='individual'|'team';
/** Promotion happens at the minimum; a held realm is only lost below minimum − demotionBuffer. */
export const realms=[
 {name:'炼气',minimum:-Infinity,range:'899 分及以下'},
 {name:'筑基',minimum:900,range:'900–999 分'},
 {name:'金丹',minimum:1000,range:'1000–1099 分'},
 {name:'元婴',minimum:1100,range:'1100–1199 分'},
 {name:'化神',minimum:1200,range:'1200 分及以上'},
] as const;
export type RealmName=typeof realms[number]['name'];
/** 化神 keeps 初期/中期/后期 across 1200–1299; from 1300 it shows 圆满. */
export const perfectionScore=1300;
const finite=(n:number,fallback:number)=>Number.isFinite(n)?n:fallback;
/** Half-away-from-zero, so a win and the mirrored loss always round to the same size. */
export const roundDelta=(x:number)=>Math.sign(x)*Math.round(Math.abs(x));
export const expectedScore=(own:number,opponent:number)=>1/(1+10**((opponent-own)/400));
export const kFactor=(ratedGames:number)=>ratedGames<realmPolicy.provisionalGames?realmPolicy.provisionalK:realmPolicy.k;
/** Change for one player who scored `result` (1 win, 0 loss) against an opponent rating. */
export function eloChange(own:number,opponent:number,result:0|1,ratedGames:number){return roundDelta(kFactor(ratedGames)*(result-expectedScore(own,opponent)))}
export function rawRealmIndex(score:number){let index=0;for(let i=1;i<realms.length;i++)if(finite(score,realmPolicy.start)>=realms[i].minimum)index=i;return index}
export function realmByScore(score:number):RealmName{return realms[rawRealmIndex(score)].name}
/** Hysteresis: promote at the threshold, keep the held realm (or the next one down) while within the buffer. */
export function settleRealmIndex(held:number,score:number){
 const raw=rawRealmIndex(score);if(raw>=held)return raw;
 for(let i=held;i>raw;i--)if(score>=realms[i].minimum-realmPolicy.demotionBuffer)return i;
 return raw;
}
export function realmProgress(score:number,held=rawRealmIndex(score)){
 const value=finite(score,realmPolicy.start),index=Math.max(0,Math.min(realms.length-1,held)),realm=realms[index],next=realms[index+1];
 const floor=index===0?(realms[1].minimum-realmPolicy.band):realm.minimum,ceiling=next?.minimum??perfectionScore;
 const progressPercent=Math.max(0,Math.min(next?99:100,Math.floor((value-floor)/(ceiling-floor)*100)));
 const perfect=!next&&value>=perfectionScore;
 const guarded=value<realm.minimum;
 return {realm:realm.name as RealmName,nextRealm:next?.name??null,stage:perfect?'圆满':progressPercent<34?'初期':progressPercent<67?'中期':'后期',progressPercent:perfect?100:progressPercent,
  score:Math.round(value),nextAt:next?.minimum??null,remaining:next?Math.max(0,Math.ceil(next.minimum-value)):0,
  /** Inside the demotion buffer the realm is kept; dropping below this score demotes. */
  demotionAt:index>0?realm.minimum-realmPolicy.demotionBuffer:null,guarded};
}

/** Rated games: complete, rated for strength and ranking, no applied handicap, distinct non-empty sides. */
export function isRatedMatch(m:Match,now=Date.now()){
 if(m.status!=='complete'||!m.monthly||!m.elo||m.handicap?.applied||m.end===null||!Number.isFinite(m.end)||m.end>now)return false;
 if(!m.a.length||!m.b.length||new Set([...m.a,...m.b]).size!==m.a.length+m.b.length)return false;
 return gameFacts(m).length>0;
}
export type RatedGame={matchId:string;eventId:string;gameIndex:number;playerId:string;side:'a'|'b';won:boolean;before:number;after:number;delta:number;k:number;expected:number;opponent:number;start:number;end:number;margin:number;settled:boolean};
type Row={score:number;games:number;wins:number;losses:number;held:number};
type Rated={score:number;games:number};
/** One game, all changes computed from the scores before it. Each player compares their
 * own score (or, in team mode, their team's average) with the opponents' average and uses
 * their own K. Singles is the standard one-to-one case of the same formula. */
export function gameChanges(a:Rated[],b:Rated[],winner:'a'|'b',doubles:DoublesExpectation=realmPolicy.doubles){
 const average=(team:Rated[])=>team.reduce((n,p)=>n+p.score,0)/team.length,avg={a:average(a),b:average(b)};
 const team=(players:Rated[],side:'a'|'b')=>players.map(p=>{const opponent=avg[side==='a'?'b':'a'],k=kFactor(p.games),expected=expectedScore(doubles==='team'?avg[side]:p.score,opponent);return {delta:roundDelta(k*((winner===side?1:0)-expected)),k,expected,opponent}});
 return {a:team(a,'a'),b:team(b,'b')};
}
/** Deterministic replay of the given matches: match end time, match id, then game order. */
export function replayRealmScores(s:Pick<State,'players'|'matches'>,include:(m:Match)=>boolean,settled:(m:Match)=>boolean=()=>true,doubles:DoublesExpectation=realmPolicy.doubles){
 const rows=new Map<string,Row>(s.players.map(p=>[p.id,{score:realmPolicy.start,games:0,wins:0,losses:0,held:rawRealmIndex(realmPolicy.start)}])),seen=new Set<string>(),games:RatedGame[]=[];
 const ordered=[...s.matches].sort((a,b)=>(a.end??Infinity)-(b.end??Infinity)||a.id.localeCompare(b.id)).filter(m=>{if(seen.has(m.id)||!include(m))return false;if(![...m.a,...m.b].every(id=>rows.has(id)))return false;seen.add(m.id);return true});
 // Realms settle once per activity: the last included match of an activity is its checkpoint.
 const last=new Map<string,number>();ordered.forEach((m,i)=>last.set(m.eventId,i));
 const participants=new Map<string,Set<string>>();
 ordered.forEach((m,i)=>{
  const ids=participants.get(m.eventId)??new Set<string>();for(const id of [...m.a,...m.b])ids.add(id);participants.set(m.eventId,ids);
  for(const g of gameFacts(m)){
   const side=(ids:string[])=>ids.map(id=>rows.get(id)!),changes=gameChanges(side(m.a),side(m.b),g.winner,doubles);
   const updates=(['a','b'] as const).flatMap(team=>m[team].map((id,i)=>{const row=rows.get(id)!,c=changes[team][i];
    return {row,game:{matchId:m.id,eventId:m.eventId,gameIndex:g.index,playerId:id,side:team,won:g.winner===team,before:row.score,after:row.score+c.delta,delta:c.delta,k:c.k,expected:c.expected,opponent:c.opponent,start:m.start??m.end!,end:m.end!,margin:team==='a'?g.a-g.b:g.b-g.a,settled:settled(m)}}}));
   for(const {row,game} of updates){row.score=game.after;row.games++;if(game.won)row.wins++;else row.losses++;games.push(game)}
  }
  if(last.get(m.eventId)===i)for(const id of participants.get(m.eventId)!){const row=rows.get(id)!;row.held=row.games<realmPolicy.placementGames?rawRealmIndex(row.score):settleRealmIndex(row.held,row.score)}
 });
 return {rows,games};
}
export type RealmSnapshot=ReturnType<typeof realmProgress>&{ratedGames:number;wins:number;losses:number;placement:boolean;pendingGames:number;pendingChange:number};
/** Visible realm and 段位分 include only activities that have concluded; running ones show as pending. */
export function realmLedger(s:Pick<State,'players'|'matches'|'events'>,now=Date.now()){
 const settled=settledMatchFilter(s,now),rated=(m:Match)=>isRatedMatch(m,now);
 const done=replayRealmScores(s,m=>rated(m)&&settled(m)),live=replayRealmScores(s,rated,settled),byPlayer=new Map<string,RatedGame[]>();
 for(const g of live.games){const list=byPlayer.get(g.playerId);if(list)list.push(g);else byPlayer.set(g.playerId,[g])}
 const snapshot=new Map(s.players.map(p=>{const row=done.rows.get(p.id)!,liveRow=live.rows.get(p.id)!,pendingGames=(byPlayer.get(p.id)??[]).filter(g=>!g.settled).length;
  return [p.id,{...realmProgress(row.score,row.held),ratedGames:row.games,wins:row.wins,losses:row.losses,placement:row.games<realmPolicy.placementGames,pendingGames,pendingChange:pendingGames?liveRow.score-row.score:0} satisfies RealmSnapshot]}));
 /** games: every completed rated game, including running activities, for the live leaderboards. */
 return {snapshot,games:live.games,byPlayer};
}
export type RealmLedger=ReturnType<typeof realmLedger>;
export function realmSnapshot(s:Pick<State,'players'|'matches'|'events'>,now=Date.now()){return realmLedger(s,now).snapshot}
export function playerRealm(s:Pick<State,'players'|'matches'|'events'>,id:string,now=Date.now()){return realmSnapshot(s,now).get(id)!}

/** One-time switch from cumulative 修为 to 段位分. Scores are derived from match
 * history on every read, so the marker only records the switch and its audit. */
export function enableEloRealms(s:State,now=Date.now()){
 if(!s.settings.initialized||s.settings.realmVersion==='elo-v1')return null;
 const snapshot=realmSnapshot(s,now);s.settings.realmVersion='elo-v1';
 return {version:'elo-v1',start:realmPolicy.start,players:s.players.map(p=>{const r=snapshot.get(p.id)!;return {playerId:p.id,score:r.score,realm:r.realm,ratedGames:r.ratedGames,legacyBase:p.cultivationBase??null}})};
}

/** This remains a strength description for matching, not the growth realm. */
export function strengthTier(rating:number){return rating<1100?'入门':rating<1232?'基础':rating<1300?'熟练':rating<1380?'进阶':'高手'}
