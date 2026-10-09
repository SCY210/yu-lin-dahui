import type {Match,State} from './types';
import {replayRating} from './ranking';

/** All website matches earn ranking points. Handicap results keep the existing
 * strength-matching safeguard, independently of ranking points. */
export function markRanked(m:Pick<Match,'monthly'|'elo'|'handicap'>){m.monthly=true;m.elo=!m.handicap?.applied}
export function enableAllRanked(s:State,now=Date.now()){
 if(!s.settings.initialized||s.settings.scoringPolicy==='all-ranked-v1')return false;
 const before=s.matches.filter(m=>m.monthly!==true||m.elo!==(!m.handicap?.applied)).map(m=>({id:m.id,monthly:m.monthly,elo:m.elo,status:m.status}));
 for(const m of s.matches)markRanked(m);
 replayRating(s,now);s.settings.scoringPolicy='all-ranked-v1';
 s.audits.push({id:crypto.randomUUID(),at:now,actor:'system:all-ranked',action:'enableAllRanked',reason:'按群主要求，网站所有已保存和后续对局统一计入排行榜积分；保留原始比分和时间',changes:{before,after:before.map(b=>{const m=s.matches.find(m=>m.id===b.id)!;return {id:m.id,monthly:m.monthly,elo:m.elo,status:m.status}})}});
 return true;
}
