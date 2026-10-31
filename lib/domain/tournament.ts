import {fail,type Event,type Match} from './types';
import type {TournamentArchive} from './tournament-results';

export type TournamentTeam={id:string;players:string[]};
export type TournamentFixture={id:string;stage:'group'|'knockout';group?:number;round:number;slot:number;a?:string;b?:string;fromA?:string;fromB?:string;matchId?:string;/** The player assigned to referee this fixture on their phone (docs/LIVE_SCORING.md). */referee?:string};
/** groups: round robin groups, then a knockout. knockout: single elimination from the draw. round-robin: everyone plays
 * everyone once in one table. Competitions created before formats existed are groups. */
export type TournamentFormat='groups'|'knockout'|'round-robin';
/** Singles is open to everyone unless men's singles; doubles are men's or mixed (one man and one woman per team).
 * Doubles competitions created before categories have none and take anyone. */
export type TournamentCategory='mens-singles'|'mens-doubles'|'mixed-doubles';
/** Games per match (1, or best of 3), points to win a game, and the cap after deuce (docs/TOURNAMENTS.md). */
export type ScoringRule={games:1|3;points:11|15|21};
export type Tournament={phase:'setup'|'groups'|'knockout';teams:TournamentTeam[];groups:string[][];advance:number;fixtures:TournamentFixture[];format?:TournamentFormat;category?:TournamentCategory;/** The group stage (and round robin) rule. */scoring?:ScoringRule;/** The knockout rule; unset, the knockout follows `scoring`. */knockoutScoring?:ScoringRule;/** Prize costs in cents for the champion, runner-up and third place; they go into the entry fee (lib/domain/money.ts). */prizes?:{first:number;second:number;third:number};/** Left by competitions from before the entry fee was computed; ignored. */fee?:number;/** The system puts ready fixtures on free courts after the draw, the knockout and every result. */autoArrange?:boolean;/** Set when archived: the final results as they stood (lib/domain/tournament-results.ts). */archive?:TournamentArchive};
export const defaultScoring:ScoringRule={games:3,points:21};
export const emptyTournament=():Tournament=>({phase:'setup',teams:[],groups:[],advance:2,fixtures:[]});
/** New competitions: groups then knockout, best of three games to 21, until the organisers choose otherwise. */
export const newTournament=():Tournament=>({...emptyTournament(),autoArrange:true,format:'groups',scoring:{...defaultScoring},knockoutScoring:{...defaultScoring}});
/** The rule of a stage: group fixtures use `scoring`, knockout fixtures `knockoutScoring` (docs/TOURNAMENTS.md). */
export function stageRule(t:Pick<Tournament,'scoring'|'knockoutScoring'>,stage:TournamentFixture['stage']){return stage==='knockout'?t.knockoutScoring??t.scoring:t.scoring}
/** The rule of one competition match, or undefined for competitions without rules and other matches. */
export function matchRule(t:Pick<Tournament,'scoring'|'knockoutScoring'|'fixtures'>|undefined,matchId:string){const f=t?.fixtures.find(f=>f.matchId===matchId);return t&&f?stageRule(t,f.stage):undefined}
export const tournamentFormat=(t:Tournament)=>t.format??'groups';
export const formatLabels:Record<TournamentFormat,string>={groups:'小组赛 → 淘汰赛',knockout:'单败淘汰赛','round-robin':'单循环赛'};
export const categoryLabels:Record<TournamentCategory,string>={'mens-singles':'男单','mens-doubles':'男双','mixed-doubles':'混双'};
/** What the competition is, for titles and lists: 单打, 男单, 男双, 混双, or 双打 for doubles without a category. */
export const categoryName=(t:Pick<Tournament,'category'>,singles:boolean)=>t.category?categoryLabels[t.category]:singles?'单打':'双打';
/** Whether a category fits the activity's singles or doubles format. */
export const categoryFits=(category:TournamentCategory,singles:boolean)=>(category==='mens-singles')===singles;
/** After deuce a game goes on until one side leads by two, and the side reaching the cap wins outright (21 → 30). */
export const scoringCap=(r:ScoringRule)=>r.points===21?30:r.points===15?21:15;
export const scoringLabel=(r:ScoringRule)=>(r.games===3?'三局两胜':'一局定胜负')+' · '+r.points+' 分制（'+(r.points-1)+' 平后领先 2 分，'+(scoringCap(r)-1)+' 平后先到 '+scoringCap(r)+' 分胜）';
/** Whether a game score is a finished game under the rule. */
export function finishedGame(r:ScoringRule,a:number,b:number){
 const w=Math.max(a,b),l=Math.min(a,b),cap=scoringCap(r);
 return w===r.points&&l<=r.points-2||w>r.points&&w<=cap&&(w-l===2||w===cap&&l===cap-1);
}
type Gendered={id:string;name:string;profile?:{gender?:string};guestGender?:string};
const gender=(p:Gendered)=>p.profile?.gender??p.guestGender;
/** Why a team does not fit the category, or null. Gender comes from the player profile (or a guest's gender). */
export function categoryProblem(category:TournamentCategory|undefined,team:Gendered[]){
 if(!category)return null;
 if(category==='mens-singles')return team.some(p=>gender(p)!=='male')?'男单只限男球友：'+team.filter(p=>gender(p)!=='male').map(p=>p.name).join('、')+' 的资料性别不是男':null;
 if(team.length!==2)return null;
 const missing=team.filter(p=>!['male','female'].includes(gender(p)??''));
 if(category==='mens-doubles'&&team.some(p=>gender(p)!=='male'))return '男双只限男球友：'+team.filter(p=>gender(p)!=='male').map(p=>p.name).join('、')+' 的资料性别不是男';
 if(category==='mixed-doubles'){
  if(missing.length)return '混双需要知道性别，请先在资料里填写：'+missing.map(p=>p.name).join('、');
  if(gender(team[0])===gender(team[1]))return '混双每队一男一女：'+team.map(p=>p.name).join(' / ');
 }
 return null;
}
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
export function tournamentChampion(t:Tournament,s:TournamentData){if(tournamentFormat(t)==='round-robin')return groupComplete(t,s)?groupStandings(t,s,0)[0]?.id:undefined;const last=t.fixtures.filter(f=>f.stage==='knockout').at(-1);return last?fixtureWinner(t,s,last):undefined}
export function assertTournamentScore(s:TournamentData,e:Event,m:Match,a:number,b:number,voiding=false,games:{a:number;b:number}[]=[]){
 const t=e.tournament;if(!t)return;
 const f=t.fixtures.find(f=>f.matchId===m.id);if(!f)fail('比赛不属于当前赛事对战表');
 if(voiding)fail('赛事对局不能作废或弃权，请录入有效比分');
 const rule=stageRule(t,f.stage);
 if(rule&&games.length){
  if(rule.games===3&&games.length<2)fail('本赛事三局两胜，请录入每一局的比分');
  if(rule.games===1&&games.length>1)fail('本赛事一局定胜负，只录入一局');
  const bad=games.find(g=>!finishedGame(rule,g.a,g.b));if(bad)fail('比分 '+bad.a+':'+bad.b+' 不是完整的一局（'+scoringLabel(rule)+'）');
 }
 if(m.status!=='complete')return;
 if(f.stage==='group'&&t.phase==='knockout')fail('已生成淘汰赛，请先返回小组赛再修正比分');
 const winnerChanged=(a>b)!==((m.scoreA??0)>(m.scoreB??0));
 if(winnerChanged&&t.fixtures.some(x=>(x.fromA===f.id||x.fromB===f.id)&&x.matchId))fail('后续淘汰赛已开打，不能更换晋级选手');
}
