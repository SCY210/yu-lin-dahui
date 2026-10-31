'use client';
import type {Tournament,TournamentFixture,TournamentData} from '../lib/domain/tournament';
import {fixtureSides,fixtureWinner,groupStandings,tournamentFormat} from '../lib/domain/tournament';
import './tournament-bracket.css';

type Props={t:Tournament;data:TournamentData&{bookings?:{id:string;name:string}[]};name:(id:string)=>string;selected?:string;onSelect?:(f:TournamentFixture)=>void;compact?:boolean};
const colW=168,headH=40;
const roundName=(fixtures:number)=>fixtures===1?'决赛':fixtures===2?'半决赛':fixtures===4?'1/4 决赛':'1/'+fixtures+' 赛';

/** The knockout as a draw sheet read left to right (docs/TOURNAMENTS.md), like a printed draw: the first column lists
 * every entry with its draw number and seed, each later column shows who went through with the score under the line,
 * and the last column the champion. A match in play is highlighted: both teams' lines, the bracket joining them and the
 * place its winner will take, with the court. Tapping a match picks it. */
export default function TournamentBracket({t,data,name,selected,onSelect,compact=false}:Props){
 const knockout=t.fixtures.filter(f=>f.stage==='knockout');if(!knockout.length)return null;
 const rounds=Math.max(...knockout.map(f=>f.round)),byRound=(r:number)=>knockout.filter(f=>f.round===r).sort((a,b)=>a.slot-b.slot);
 const first=byRound(1),size=first.length*2,doubles=t.teams.some(team=>team.players.length>1),cellH=doubles?(compact?50:60):(compact?36:42);
 const seeded=tournamentFormat(t)==='knockout';
 const seedOf=(id:string)=>{if(seeded){const i=t.teams.findIndex(x=>x.id===id);return i>=0&&i<8?'('+(i+1)+')':''}const g=t.groups.findIndex(group=>group.includes(id));return g>=0?String.fromCharCode(65+g)+(groupStandings(t,data,g).findIndex(row=>row.id===id)+1):''};
 const players=(id:string|null|undefined)=>id?t.teams.find(x=>x.id===id)?.players.map(name)??['待定']:[id===null?'轮空':'待定'];
 const match=(f:TournamentFixture)=>data.matches.find(m=>m.id===f.matchId);
 const playing=(f:TournamentFixture|undefined)=>!!f&&match(f)?.status==='playing';
 const parentOf=(f:TournamentFixture)=>knockout.find(p=>p.fromA===f.id||p.fromB===f.id);
 const score=(f:TournamentFixture)=>{const m=match(f);if(m?.status!=='complete')return '';const {a}=fixtureSides(t,data,f),flip=fixtureWinner(t,data,f)!==a;return (m.games.length?m.games:[{a:m.scoreA??0,b:m.scoreB??0}]).map(g=>flip?g.b+'–'+g.a:g.a+'–'+g.b).join(', ')};
 // Names sit on a line at the bottom of their cell. Entry i's line closes row i; a fixture of round r covers 2^r
 // entries and its winner's line lies halfway between the lines of its two entries.
 const line=(round:number,slot:number)=>headH+((slot+.5)*2**round+.5)*cellH;
 const height=headH+size*cellH+(compact?8:24),width=(rounds+1)*colW;
 const leaves=first.flatMap(f=>{const {a,b}=fixtureSides(t,data,f);return [{f,team:a},{f,team:b}]});
 const champion=fixtureWinner(t,data,byRound(rounds)[0]);
 const names=(id:string|null|undefined,muted=false)=><span className={'draw-names'+(muted?' is-muted':'')}>{players(id).map((n,i)=><span key={i}>{n}{i===0&&id&&seedOf(id)&&<em> {seedOf(id)}</em>}</span>)}</span>;
 return <div className={'draw-sheet'+(compact?' is-compact':'')}>
  <div className="draw-sheet-scroll" role="region" aria-label="淘汰赛对阵图" tabIndex={0}>
   <div className="draw-sheet-canvas" style={{width,height}}>
    {Array.from({length:rounds+1},(_,c)=><div key={c} className="draw-head" style={{left:c*colW,width:colW}}>{c<rounds?roundName(byRound(c+1).length):'冠军'}</div>)}
    {leaves.map(({f,team},i)=>{const winner=fixtureWinner(t,data,f),won=!!team&&winner===team,out=!!winner&&!won&&team!==null;
     return <div key={'leaf'+i} className={'draw-cell draw-entry'+(won?' is-won':'')+(out?' is-out':'')+(playing(f)?' is-playing':'')} style={{left:0,top:headH+i*cellH,width:colW,height:cellH}}>
      <span className="draw-index">{i+1}</span>{names(team,team===null)}
     </div>})}
    {knockout.map(f=>{
     // The bracket joining this match's two entries, and the place its winner takes in the next column.
     const y1=line(f.round-1,f.slot*2),y2=line(f.round-1,f.slot*2+1),y=line(f.round,f.slot),x=f.round*colW,m=match(f),winner=fixtureWinner(t,data,f),live=m?.status==='playing',next=parentOf(f);
     const court=live?data.bookings?.find(b=>b.id===m!.courtId)?.name:undefined;
     return <div key={f.id}>
      <div className={'draw-join'+(live?' is-live':winner?' is-won':'')} style={{left:x-1,top:y1,height:y2-y1}}/>
      <button type="button" className={'draw-cell is-result'+(f.round===rounds?' is-final':'')+(winner?' is-won':'')+(live?' is-live':'')+(playing(next)?' is-playing':'')+(selected===f.id?' is-selected':'')} style={{left:x,top:y-cellH,width:colW,height:cellH}} onClick={()=>onSelect?.(f)} aria-label={roundName(byRound(f.round).length)+' 第 '+(f.slot+1)+' 场'+(winner?'，'+players(winner).join(' / ')+' 晋级':live?'，正在比赛':'')}>
       {winner?names(winner):live?<span className="draw-live">● 正在比赛{court?' · '+court:''}</span>:null}
      </button>
      {score(f)&&<span className="draw-score" style={{left:x+8,top:y+3,width:colW-12}}>{score(f)}</span>}
     </div>;
    })}
    {champion&&<div className="draw-champion" style={{left:rounds*colW+8,top:line(rounds,0)+22,width:colW-12}}>🏆 冠军</div>}
   </div>
  </div>
 </div>;
}
