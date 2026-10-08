import {winner} from './social';
import {pointGrants} from './point-grants';
import {cultivationSnapshot} from './cultivation';
import {settledMatchFilter} from './event-lifecycle';
import {gameFacts} from './game-facts';
import {defaultRules,month,type State,type Rules,type Match} from './types';
import {quarterMonths} from '../ranking-quarter';
/** Website rounds are 2v2. Singles means exactly one different player on each side. */
export function isSinglesMatch(m:Pick<Match,'a'|'b'>){return m.a.length===1&&m.b.length===1&&m.a[0]!==m.b[0]}
/** The hidden doubles-elo-v1 strength only rates 2v2 matches, so singles never move doubles grouping strength. */
export function isDoublesMatch(m:Pick<Match,'a'|'b'>){return m.a.length===2&&m.b.length===2}
/** all: the established board (every recorded website match plus owner grants). singles: 1v1 matches only, same rules, no grants. */
export type RankingFormat='all'|'singles';
export function validScore(a:number,b:number,r:Rules=defaultRules){if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<0||a===b)return false;const hi=Math.max(a,b),lo=Math.min(a,b);return hi<=r.ceiling&&((hi===r.target&&lo<=hi-r.lead)||(hi>r.target&&hi<r.ceiling&&hi-lo===r.lead)||(hi===r.ceiling&&lo>=r.ceiling-r.lead&&lo<hi))}
export function replayRating(s:State){for(const p of s.players){p.rating=p.initialRating;p.ratedGames=0}const changes:{matchId:string;playerId:string;before:number;after:number;delta:number;algorithm:string}[]=[];
 for(const m of s.matches.filter(m=>m.status==='complete'&&m.elo&&isDoublesMatch(m)).sort((a,b)=>(a.end!-b.end!)||a.id.localeCompare(b.id))){const a=m.a.map(id=>s.players.find(p=>p.id===id)!),b=m.b.map(id=>s.players.find(p=>p.id===id)!);const ra=(a[0].rating+a[1].rating)/2,rb=(b[0].rating+b[1].rating)/2;const rules=s.seasons.find(x=>x.id===month(m.start!))?.rules??s.settings.rules;const expected=1/(1+10**((rb-ra)/400)),delta=rules.k*((winner(m)==='a'?1:0)-expected);for(const [ps,d]of [[a,delta],[b,-delta]] as const)for(const p of ps){changes.push({matchId:m.id,playerId:p.id,before:p.rating,after:p.rating+d,delta:d,algorithm:rules.algorithm});p.rating+=d;p.ratedGames++}}
 s.ratingChanges=changes.map(c=>({...c,id:c.matchId+':'+c.playerId,k:s.seasons.find(x=>x.id===month(s.matches.find(m=>m.id===c.matchId)!.start!))?.rules.k??s.settings.rules.k}));return changes;
}
/** Visible strength labels settle like realms; matchmaking keeps the live rating. */
export function settledRatings(s:State,now=Date.now()){const copy:State={...s,players:s.players.map(p=>({...p})),matches:s.matches.filter(settledMatchFilter(s,now)),ratingChanges:[]};replayRating(copy);return new Map(copy.players.map(p=>[p.id,p.rating]))}
export function leaderboard(s:State,season:string,now=Date.now()){return aggregateLeaderboard(s,[season],now)}
function aggregateLeaderboard(s:State,periods:string[],now=Date.now(),format:RankingFormat='all'){
 const singles=format==='singles',chosen=new Set(periods),growth=cultivationSnapshot(s,now),grants=singles?[]:pointGrants(s),bonus=new Map<string,number>();
 for(const g of grants)if(chosen.has(g.period))bonus.set(g.playerId,(bonus.get(g.playerId)??0)+g.points);
 const members=new Set(s.accounts.map(account=>account.playerId));
 const rows=s.players.filter(p=>p.enabled&&members.has(p.id)).map(p=>{
  const all=s.matches.filter(m=>m.status==='complete'&&m.start!==null&&chosen.has(month(m.start))&&[...m.a,...m.b].includes(p.id)&&(!singles||isSinglesMatch(m))&&gameFacts(m).length>0);
  let games=0,wins=0,net=0,score=0;
  for(const period of periods){const rules=s.seasons.find(x=>x.id===period)?.rules??s.settings.rules;
   const eligible=all.filter(m=>m.monthly&&month(m.start!)===period).sort((a,b)=>a.start!-b.start!||a.id.localeCompare(b.id)).flatMap(gameFacts);
   const scored=rules.cap?eligible.slice(0,rules.cap):eligible;
   let periodWins=0;for(const g of scored){const side=g.match.a.includes(p.id)?'a':'b';periodWins+=g.winner===side?1:0;net+=side==='a'?g.a-g.b:g.b-g.a}
   games+=scored.length;wins+=periodWins;score+=periodWins*rules.win+(scored.length-periodWins)*rules.loss;
  }
  const cultivation=growth.get(p.id)!;
  return {playerId:p.id,name:p.name,rating:p.rating,realm:cultivation.realm,cultivation,provisional:false,strengthProvisional:p.ratedGames<10,total:all.reduce((n,m)=>n+gameFacts(m).length,0),totalMatches:all.length,games,wins,losses:games-wins,points:score+(bonus.get(p.id)??0),matchPoints:score,manualPoints:bonus.get(p.id)??0,rate:games?wins/games:0,margin:games?net/games:0,qualified:true,rank:0};
 }).filter(row=>!singles||row.totalMatches>0).sort((a,b)=>b.points-a.points||b.rate-a.rate||b.margin-a.margin||a.playerId.localeCompare(b.playerId));
 rows.forEach((row,i)=>{const prev=rows[i-1];row.rank=prev&&prev.points===row.points&&prev.rate===row.rate&&prev.margin===row.margin?prev.rank:i+1});return rows;
}
const yearMonths=(year:number)=>Array.from({length:12},(_,i)=>year+'-'+String(i+1).padStart(2,'0'));
export function quarterlyLeaderboard(s:State,quarter:string,now=Date.now()){return aggregateLeaderboard(s,quarterMonths(quarter),now)}
export function annualLeaderboard(s:State,year:number,now=Date.now()){return aggregateLeaderboard(s,yearMonths(year),now)}
/** Singles boards list only members with a completed singles match in the period; the main boards stay unchanged.
 * Points stay live; realms shown on the rows settle per activity like the combined board. */
export function singlesLeaderboard(s:State,season:string,now=Date.now()){return aggregateLeaderboard(s,[season],now,'singles')}
export function singlesQuarterlyLeaderboard(s:State,quarter:string,now=Date.now()){return aggregateLeaderboard(s,quarterMonths(quarter),now,'singles')}
export function singlesAnnualLeaderboard(s:State,year:number,now=Date.now()){return aggregateLeaderboard(s,yearMonths(year),now,'singles')}
