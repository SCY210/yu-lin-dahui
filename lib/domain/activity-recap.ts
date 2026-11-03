import {gameFacts} from './game-facts';
import type {Match} from './types';

export type RecapGame={matchId:string;a:string[];b:string[];scoreA:number;scoreB:number};
export type RecapPlayer={playerId:string;games:number;wins:number;losses:number};
export type ActivityRecap={
 games:number;players:number;points:number;
 /** Most games won; several players when tied (at most three). */
 topWinners:RecapPlayer[];
 /** Best win rate among players with at least three games, when it is not already a top winner's 100%. */
 bestRate?:RecapPlayer;
 /** Longest run of games won in a row, three or more. */
 streak?:{playerIds:string[];length:number};
 /** The doubles pair with the most wins together, two or more. */
 pair?:{playerIds:[string,string];wins:number;games:number};
 /** The closest game (smallest margin, then most points) and the most one-sided game (margin ten or more). */
 closest?:RecapGame;rout?:RecapGame;
 byPlayer:Record<string,RecapPlayer>;
};

/** The battle summary of one activity, from its completed games only (docs/ACTIVITY_RECAP.md). Computed in the client
 * from the matches the viewer can already see: no server work, no stored data. */
export function activityRecap(matches:Match[],eventId:string):ActivityRecap{
 const facts=matches.filter(m=>m.eventId===eventId).flatMap(gameFacts).sort((x,y)=>x.match.end!-y.match.end!||x.match.id.localeCompare(y.match.id)||x.index-y.index);
 const byPlayer:Record<string,RecapPlayer>={},run=new Map<string,number>(),best=new Map<string,number>(),pairs=new Map<string,{playerIds:[string,string];wins:number;games:number}>();
 let points=0,closest:RecapGame|undefined,rout:RecapGame|undefined;
 const margin=(g:RecapGame)=>Math.abs(g.scoreA-g.scoreB),total=(g:RecapGame)=>g.scoreA+g.scoreB;
 for(const f of facts){
  const m=f.match,game={matchId:m.id,a:m.a,b:m.b,scoreA:f.a,scoreB:f.b};points+=f.a+f.b;
  if(!closest||margin(game)<margin(closest)||margin(game)===margin(closest)&&total(game)>total(closest))closest=game;
  if(margin(game)>=10&&(!rout||margin(game)>margin(rout)))rout=game;
  for(const side of ['a','b'] as const){
   const won=f.winner===side,team=m[side];
   for(const id of team){
    const p=byPlayer[id]??={playerId:id,games:0,wins:0,losses:0};p.games++;if(won)p.wins++;else p.losses++;
    const length=won?(run.get(id)??0)+1:0;run.set(id,length);best.set(id,Math.max(best.get(id)??0,length));
   }
   if(team.length===2){
    const ids=[...team].sort() as [string,string],key=ids.join('|'),pair=pairs.get(key)??{playerIds:ids,wins:0,games:0};
    pair.games++;if(won)pair.wins++;pairs.set(key,pair);
   }
  }
 }
 const players=Object.values(byPlayer),most=Math.max(0,...players.map(p=>p.wins));
 const topWinners=most?players.filter(p=>p.wins===most).sort((x,y)=>x.losses-y.losses||x.playerId.localeCompare(y.playerId)).slice(0,3):[];
 const rate=(p:RecapPlayer)=>p.wins/p.games;
 const bestRate=players.filter(p=>p.games>=3&&!topWinners.includes(p)).sort((x,y)=>rate(y)-rate(x)||y.games-x.games||x.playerId.localeCompare(y.playerId))[0];
 const longest=Math.max(0,...best.values());
 const pair=[...pairs.values()].filter(p=>p.wins>=2).sort((x,y)=>y.wins-x.wins||x.games-y.games||x.playerIds.join().localeCompare(y.playerIds.join()))[0];
 return {
  games:facts.length,players:players.length,points,topWinners,
  ...(bestRate&&rate(bestRate)>(topWinners[0]?rate(topWinners[0]):0)?{bestRate}:{}),
  ...(longest>=3?{streak:{playerIds:[...best].filter(([,n])=>n===longest).map(([id])=>id).sort(),length:longest}}:{}),
  ...(pair?{pair}:{}),...(closest?{closest}:{}),...(rout?{rout}:{}),byPlayer,
 };
}
