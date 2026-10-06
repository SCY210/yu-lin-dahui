import type {Match} from './types';
/** A recorded best-of-three is several games, while Elo still sees one match. */
export function gameFacts(match:Match){
 if(match.status!=='complete'||match.start===null||match.end===null||!Number.isFinite(match.start)||!Number.isFinite(match.end)||match.end<=match.start)return [];
 const games=match.games?.length?match.games:[{a:match.scoreA!,b:match.scoreB!}];
 return games.filter(g=>Number.isInteger(g.a)&&Number.isInteger(g.b)&&g.a>=0&&g.b>=0&&g.a!==g.b).map((g,index)=>({...g,index,match,winner:g.a>g.b?'a' as const:'b' as const}));
}
export function gameRecord(match:Match,playerId:string){const side=match.a.includes(playerId)?'a':match.b.includes(playerId)?'b':null;if(!side)return {games:0,wins:0,losses:0,margin:0};const facts=gameFacts(match),wins=facts.filter(g=>g.winner===side).length;return {games:facts.length,wins,losses:facts.length-wins,margin:facts.reduce((sum,g)=>sum+(side==='a'?g.a-g.b:g.b-g.a),0)}}
