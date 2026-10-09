import {month,type State} from './types';

/** One-time switch for defaults and the current Madrid month only.
 * Older seasons keep their historical rules. Since elo-v1 the win/loss values no longer drive points.
 */
export function enableSignedRanking(s:State,now=Date.now()){
 if(!s.settings.initialized||s.settings.rankingVersion==='signed-v1')return false;
 const upgrade=(rules:State['settings']['rules'])=>{
  if(rules.loss<0)return false;
  rules.loss=rules.loss===0?-3:-rules.loss;return true;
 };
 upgrade(s.settings.rules);
 const current=month(now);
 for(const season of s.seasons)if(season.id===current&&upgrade(season.rules))season.version=(season.version??1)+1;
 s.settings.rankingVersion='signed-v1';return true;
}
