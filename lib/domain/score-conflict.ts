import {z} from 'zod';
import {fail,type Match,type State} from './types';

const game=z.object({a:z.number().int().min(0).max(150),b:z.number().int().min(0).max(150)});
/** The games a score form saw when it opened; empty while the match is unscored. */
export const scoreGames=z.array(game);
type Game=z.infer<typeof game>;
const sameGames=(x:Game[],y:Game[])=>x.length===y.length&&x.every((g,i)=>g.a===y[i].a&&g.b===y[i].b);

const team=(s:Pick<State,'players'>,ids:string[])=>ids.map(id=>s.players.find(p=>p.id===id)?.name??'球友').join('/');

/** Name of the player whose account last saved this match's score. */
export function scorerName(s:Pick<State,'accounts'|'players'>,m:Pick<Match,'enteredBy'>){
 const account=s.accounts.find(a=>a.id===m.enteredBy);
 return s.players.find(p=>p.id===account?.playerId)?.name??'其他球友';
}

/** Members cannot read accounts, so the projection names the player who saved a score (shown on score conflicts). */
export function withScorer(s:Pick<State,'accounts'>,m:Match):Match&{enteredByPlayerId?:string}{
 const playerId=m.enteredBy?s.accounts.find(a=>a.id===m.enteredBy)?.playerId:undefined;
 return playerId?{...m,enteredByPlayerId:playerId}:m;
}

/** Several players often type the same game's score at once. An unchanged match saves normally; the same score
 * arriving from a second phone is accepted without changing anything; a different score is refused with who
 * entered what, so nobody overwrites another player's entry without seeing it first. */
export function scoreConflict(s:Pick<State,'accounts'|'players'>,m:Match,expected:Game[],games:Game[]):'none'|'same'{
 if(sameGames(m.games,expected))return 'none';
 if(m.status==='complete'&&sameGames(m.games,games))return 'same';
 return fail('409: '+(m.status==='complete'
  ?scorerName(s,m)+' 刚刚录入了比分：'+team(s,m.a)+' '+m.games.map(g=>g.a+' : '+g.b).join('，')+' '+team(s,m.b)+'。请核对，比分不对再点“修正比分”。'
  :'这局的比分刚刚有变动，请重新打开录分。'));
}
