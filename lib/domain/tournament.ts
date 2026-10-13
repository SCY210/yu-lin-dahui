import {fail,type Event,type Match} from './types';

export type TournamentTeam={id:string;players:string[]};
export type TournamentFixture={id:string;stage:'group'|'knockout';group?:number;round:number;slot:number;a?:string;b?:string;fromA?:string;fromB?:string;matchId?:string};
export type Tournament={phase:'setup'|'groups'|'knockout';teams:TournamentTeam[];groups:string[][];advance:number;fixtures:TournamentFixture[]};
export const emptyTournament=():Tournament=>({phase:'setup',teams:[],groups:[],advance:2,fixtures:[]});
export type TournamentData={matches:Match[]};
export function groupStandings(t:Tournament,s:TournamentData,group:number){
 const rows=(t.groups[group]??[]).map((id,index)=>({id,seed:index,played:0,wins:0,losses:0,for:0,against:0,difference:0}));
 for(const f of t.fixtures.filter(f=>f.stage==='group'&&f.group===group)){
  const m=s.matches.find(m=>m.id===f.matchId);if(m?.status!=='complete')continue;
  const a=rows.find(r=>r.id===f.a),b=rows.find(r=>r.id===f.b);if(!a||!b)continue;
  a.played++;b.played++;if((m.scoreA??0)>(m.scoreB??0)){a.wins++;b.losses++}else{b.wins++;a.losses++}
  for(const game of m.games.length?m.games:[{a:m.scoreA??0,b:m.scoreB??0}]){a.for+=game.a;a.against+=game.b;b.for+=game.b;b.against+=game.a}
 }
 rows.forEach(r=>r.difference=r.for-r.against);
 return rows.sort((a,b)=>b.wins-a.wins||b.difference-a.difference||b.for-a.for||a.seed-b.seed);
}
export function fixtureSides(t:Tournament,s:TournamentData,f:TournamentFixture):{a:string|null|undefined;b:string|null|undefined}{
 const side=(team:string|undefined,source:string|undefined)=>source?fixtureWinner(t,s,t.fixtures.find(x=>x.id===source)!):team??null;
 return {a:side(f.a,f.fromA),b:side(f.b,f.fromB)};
}
/** undefined means unresolved; null is an empty bracket slot, not a result. */
export function fixtureWinner(t:Tournament,s:TournamentData,f:TournamentFixture):string|null|undefined{
 if(!f)return undefined;
 const {a,b}=fixtureSides(t,s,f);if(a===undefined||b===undefined)return undefined;
 if(!a)return b;if(!b)return a;
 const m=s.matches.find(m=>m.id===f.matchId);return m?.status==='complete'?((m.scoreA??0)>(m.scoreB??0)?a:b):undefined;
}
export function groupComplete(t:Tournament,s:TournamentData){return t.fixtures.some(f=>f.stage==='group')&&t.fixtures.filter(f=>f.stage==='group').every(f=>s.matches.some(m=>m.id===f.matchId&&m.status==='complete'))}
export function tournamentChampion(t:Tournament,s:TournamentData){const last=t.fixtures.filter(f=>f.stage==='knockout').at(-1);return last?fixtureWinner(t,s,last):undefined}
export function assertTournamentScore(s:TournamentData,e:Event,m:Match,a:number,b:number,voiding=false){
 const t=e.tournament;if(!t)return;
 const f=t.fixtures.find(f=>f.matchId===m.id);if(!f)fail('比赛不属于当前赛事对战表');
 if(voiding)fail('赛事对局不能作废或弃权，请录入有效比分');
 if(m.status!=='complete')return;
 if(f.stage==='group'&&t.phase==='knockout')fail('已生成淘汰赛，请先返回小组赛再修正比分');
 const winnerChanged=(a>b)!==((m.scoreA??0)>(m.scoreB??0));
 if(winnerChanged&&t.fixtures.some(x=>(x.fromA===f.id||x.fromB===f.id)&&x.matchId))fail('后续淘汰赛已开打，不能更换晋级选手');
}
