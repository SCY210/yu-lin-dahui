'use client';
import type {Tournament,TournamentFixture,TournamentData} from '../lib/domain/tournament';
import {fixtureSides,fixtureWinner,groupStandings,tournamentFormat} from '../lib/domain/tournament';
import './tournament-bracket.css';

type Props={t:Tournament;data:TournamentData&{bookings?:{id:string;name:string}[]};name:(id:string)=>string;selected?:string;onSelect?:(f:TournamentFixture)=>void;compact?:boolean};
type Side='left'|'right';
const colW=136,headH=40;
const roundName=(fixtures:number)=>fixtures===1?'决赛':fixtures===2?'半决赛':fixtures===4?'1/4 决赛':'1/'+fixtures+' 赛';

/** The knockout as a printed draw folded in two (docs/TOURNAMENTS.md): the top half of the draw runs left to right, the
 * bottom half right to left, and both meet at the final in the middle, so the sheet is half as tall. Each entry has its
 * draw number and seed on a line; each later column shows who went through with the score under the line. A match in
 * play is highlighted: both teams, the bracket joining them and the place its winner takes, with the court. Tapping a
 * match picks it. */
export default function TournamentBracket({t,data,name,selected,onSelect,compact=false}:Props){
 const knockout=t.fixtures.filter(f=>f.stage==='knockout');if(!knockout.length)return null;
 const rounds=Math.max(...knockout.map(f=>f.round)),byRound=(r:number)=>knockout.filter(f=>f.round===r).sort((a,b)=>a.slot-b.slot);
 const first=byRound(1),size=first.length*2,doubles=t.teams.some(team=>team.players.length>1),cellH=doubles?(compact?50:58):(compact?34:40);
 const seeded=tournamentFormat(t)==='knockout';
 const seedOf=(id:string)=>{if(seeded){const i=t.teams.findIndex(x=>x.id===id);return i>=0&&i<8?'('+(i+1)+')':''}const g=t.groups.findIndex(group=>group.includes(id));return g>=0?String.fromCharCode(65+g)+(groupStandings(t,data,g).findIndex(row=>row.id===id)+1):''};
 const players=(id:string|null|undefined)=>id?t.teams.find(x=>x.id===id)?.players.map(name)??['待定']:[id===null?'轮空':'待定'];
 const match=(f:TournamentFixture)=>data.matches.find(m=>m.id===f.matchId);
 const playing=(f:TournamentFixture|undefined)=>!!f&&match(f)?.status==='playing';
 const parentOf=(f:TournamentFixture)=>knockout.find(p=>p.fromA===f.id||p.fromB===f.id);
 const score=(f:TournamentFixture)=>{const m=match(f);if(m?.status!=='complete')return '';const {a}=fixtureSides(t,data,f),flip=fixtureWinner(t,data,f)!==a;return (m.games.length?m.games:[{a:m.scoreA??0,b:m.scoreB??0}]).map(g=>flip?g.b+'–'+g.a:g.a+'–'+g.b).join(', ')};
 // Each half holds half the entries. Columns: entries, then one per round toward the middle, where the final sits.
 const perHalf=Math.max(1,size/2),width=(2*rounds+1)*colW,height=headH+perHalf*cellH+(compact?8:24);
 const x=(col:number,side:Side)=>side==='left'?col*colW:width-(col+1)*colW;
 // Names sit on a line at the bottom of their cell. Entry i's line closes row i of its half; a round-r match covers
 // 2^r entries of its half and its winner's line lies halfway between the lines of its two entries.
 const line=(round:number,slot:number)=>headH+((slot+.5)*2**round+.5)*cellH;
 const half=(round:number,slot:number)=>{const n=byRound(round).length;return n===1?null:slot<n/2?{side:'left' as Side,slot}:{side:'right' as Side,slot:slot-n/2}};
 const leaves=first.flatMap(f=>{const {a,b}=fixtureSides(t,data,f);return [{f,team:a},{f,team:b}]});
 const final=byRound(rounds)[0],champion=fixtureWinner(t,data,final),fy=line(rounds-1,0),liveFinal=playing(final);
 const names=(id:string|null|undefined,muted=false)=><span className={'draw-names'+(muted?' is-muted':'')}>{players(id).map((n,i)=><span key={i}>{n}{i===0&&id&&seedOf(id)&&<em> {seedOf(id)}</em>}</span>)}</span>;
 // A column is headed by the round its players play next: the entries play the first round, the last column the final.
 const heads=Array.from({length:rounds},(_,c)=>roundName(byRound(c+1).length));
 return <div className={'draw-sheet'+(compact?' is-compact':'')}>
  <div className="draw-sheet-scroll" role="region" aria-label="淘汰赛对阵图" tabIndex={0}>
   <div className="draw-sheet-canvas" style={{width,height}}>
    {(['left','right'] as Side[]).flatMap(side=>heads.map((h,c)=><div key={side+c} className="draw-head" style={{left:x(c,side),width:colW}}>{h}</div>))}
    <div className="draw-head is-final" style={{left:rounds*colW,width:colW}}>冠军</div>
    {leaves.map(({f,team},i)=>{
     // With one match only (two entries), one entry stands on each side of the final.
     const side:Side=size===2?(i===0?'left':'right'):i<perHalf?'left':'right',row=size===2?0:i%perHalf;
     const winner=fixtureWinner(t,data,f),won=!!team&&winner===team,out=!!winner&&!won&&team!==null;
     return <div key={'leaf'+i} className={'draw-cell draw-entry is-'+side+(won?' is-won':'')+(out?' is-out':'')+(playing(f)?' is-playing':'')} style={{left:x(0,side),top:headH+row*cellH,width:colW,height:cellH}}>
      <span className="draw-index">{i+1}</span>{names(team,team===null)}
     </div>;
    })}
    {knockout.filter(f=>f.round<rounds).map(f=>{
     const at=half(f.round,f.slot)!,side=at.side,y1=line(f.round-1,at.slot*2),y2=line(f.round-1,at.slot*2+1),y=line(f.round,at.slot);
     const m=match(f),winner=fixtureWinner(t,data,f),live=m?.status==='playing',court=live?data.bookings?.find(b=>b.id===m!.courtId)?.name:undefined;
     const joinX=side==='left'?f.round*colW:width-f.round*colW;
     return <div key={f.id}>
      <div className={'draw-join'+(live?' is-live':winner?' is-won':'')} style={{left:joinX-1,top:y1,height:y2-y1}}/>
      <button type="button" className={'draw-cell is-result is-'+side+(winner?' is-won':'')+(live?' is-live':'')+(playing(parentOf(f))?' is-playing':'')+(selected===f.id?' is-selected':'')} style={{left:x(f.round,side),top:y-cellH,width:colW,height:cellH}} onClick={()=>onSelect?.(f)} aria-label={roundName(byRound(f.round).length)+' 第 '+(f.slot+1)+' 场'+(winner?'，'+players(winner).join(' / ')+' 晋级':live?'，正在比赛':'')}>
       {winner?names(winner):live?<span className="draw-live">● 正在比赛{court?' · '+court:''}</span>:null}
      </button>
      {score(f)&&<span className={'draw-score is-'+side} style={{left:x(f.round,side)+6,top:y+3,width:colW-12}}>{score(f)}</span>}
     </div>;
    })}
    {/* The final in the middle: the two half winners' lines meet here, and the champion stands on the centre line. */}
    <button type="button" className={'draw-cell is-result is-final'+(champion?' is-won':'')+(liveFinal?' is-live':'')+(selected===final.id?' is-selected':'')} style={{left:rounds*colW,top:fy-cellH,width:colW,height:cellH}} onClick={()=>onSelect?.(final)} aria-label={'决赛'+(champion?'，冠军 '+players(champion).join(' / '):liveFinal?'，正在比赛':'')}>
     {champion?<span className="draw-champion">🏆 {names(champion)}</span>:liveFinal?<span className="draw-live">● 正在比赛{(()=>{const m=match(final);const c=m&&data.bookings?.find(b=>b.id===m.courtId)?.name;return c?' · '+c:''})()}</span>:null}
    </button>
    {score(final)&&<span className="draw-score is-final" style={{left:rounds*colW+6,top:fy+3,width:colW-12}}>{score(final)}</span>}
   </div>
  </div>
 </div>;
}
