'use client';
import {useState} from 'react';
import {Maximize2,Minimize2} from 'lucide-react';
import type {Tournament,TournamentFixture,TournamentData} from '../lib/domain/tournament';
import {fixtureSides,fixtureWinner,tournamentFormat} from '../lib/domain/tournament';
import './tournament-bracket.css';

type Props={t:Tournament;data:TournamentData;name:(id:string)=>string;selected?:string;onSelect?:(f:TournamentFixture)=>void;compact?:boolean};
type Child={kind:'leaf';team:string|null|undefined;y:number;x:number}|{kind:'fixture';f:TournamentFixture;y:number;x:number};
const rowH=30,labelW=168,colW=38,top=34;

/** The knockout as a draw sheet (docs/TOURNAMENTS.md): every first-round entry is a line on the left or right edge,
 * and lines join pairs round by round toward the final in the middle. Lines a winner has travelled are highlighted,
 * matches in play pulse, and each decided junction names its winner, so progress reads at a glance on a phone or the
 * board. Selecting a junction picks that fixture. */
export default function TournamentBracket({t,data,name,selected,onSelect,compact=false}:Props){
 const [fit,setFit]=useState(true);
 const knockout=t.fixtures.filter(f=>f.stage==='knockout');if(!knockout.length)return null;
 const rounds=Math.max(...knockout.map(f=>f.round)),final=knockout.find(f=>f.round===rounds)!;
 const byId=new Map(knockout.map(f=>[f.id,f])),seeded=tournamentFormat(t)==='knockout';
 const teamName=(id:string|null|undefined)=>id===null?'轮空':id?t.teams.find(x=>x.id===id)?.players.map(name).join(' / ')??'待定':'待定';
 const seedOf=(id:string)=>{if(seeded){const i=t.teams.findIndex(x=>x.id===id);return i>=0&&i<8?String(i+1):''}const g=t.groups.findIndex(group=>group.includes(id));return g>=0?String.fromCharCode(65+g):''};
 const playing=(f:TournamentFixture)=>data.matches.some(m=>m.id===f.matchId&&m.status==='playing');
 const score=(f:TournamentFixture)=>{const m=data.matches.find(m=>m.id===f.matchId&&m.status==='complete');return m?(m.games.length>1?m.games.map(g=>g.a+'-'+g.b).join(' '):m.scoreA+'-'+m.scoreB):''};
 // Leaves on each side in draw order; a fixture sits halfway between its two children.
 const rows={left:0,right:0},lines:{d:string;won:boolean;live:boolean}[]=[],labels:{x:number;y:number;text:string;seed:string;anchor:'start'|'end';empty:boolean}[]=[],junctions:{f:TournamentFixture;x:number;y:number;anchor:'start'|'end'}[]=[];
 const width=2*(labelW+rounds*colW)+(rounds>1?0:colW),half=width/2;
 const xOf=(round:number,side:'left'|'right')=>{const x=labelW+round*colW;return side==='left'?x:width-x};
 const place=(child:{team?:string|null;f?:TournamentFixture},side:'left'|'right'):Child=>{
  if(child.f){
   const f=child.f,{a,b}=fixtureSides(t,data,f),kids=[f.fromA?{f:byId.get(f.fromA)}:{team:a},f.fromB?{f:byId.get(f.fromB)}:{team:b}].map(k=>place(k,side)),y=(kids[0].y+kids[1].y)/2,x=xOf(f.round,side),winner=fixtureWinner(t,data,f);
   for(const k of kids){const from=k.kind==='leaf'?k.team:fixtureWinner(t,data,k.f);lines.push({d:`M${k.x} ${k.y}H${x}V${y}`,won:!!winner&&from===winner,live:playing(f)})}
   junctions.push({f,x,y,anchor:side==='left'?'start':'end'});
   return {kind:'fixture',f,x,y};
  }
  const y=top+rows[side]++*rowH+rowH/2,x=side==='left'?labelW:width-labelW,team=child.team;
  labels.push({x:side==='left'?labelW-8:width-labelW+8,y,text:teamName(team),seed:team?seedOf(team):'',anchor:side==='left'?'end':'start',empty:!team});
  return {kind:'leaf',team,x,y};
 };
 // The final's two halves go left and right; a two-team final has one entry on each side.
 const {a:fa,b:fb}=fixtureSides(t,data,final),left=place(final.fromA?{f:byId.get(final.fromA)}:{team:fa},'left'),right=place(final.fromB?{f:byId.get(final.fromB)}:{team:fb},'right');
 const fy=(left.y+right.y)/2,champion=fixtureWinner(t,data,final);
 for(const [k,from] of [[left,left.kind==='leaf'?left.team:fixtureWinner(t,data,left.f)],[right,right.kind==='leaf'?right.team:fixtureWinner(t,data,right.f)]] as const)lines.push({d:`M${k.x} ${k.y}H${half}V${fy}`,won:!!champion&&from===champion,live:playing(final)});
 const height=top+Math.max(rows.left,rows.right)*rowH+16;
 const pick=(f:TournamentFixture)=>onSelect?.(f);
 return <div className={'draw-sheet'+(compact?' is-compact':'')}>
  {!compact&&<div className="draw-sheet-tools"><p className="hint">两侧逐轮晋级，在中间会师决赛。高亮线是胜者走过的路，闪动的是正在进行的比赛；点交汇处查看该场。</p><button type="button" className="ghost" onClick={()=>setFit(!fit)}>{fit?<><Maximize2 size={15}/>原大</>:<><Minimize2 size={15}/>适应屏幕</>}</button></div>}
  <div className="draw-sheet-scroll" role="region" aria-label="淘汰赛对阵图" tabIndex={0}>
   <svg className="draw-sheet-svg" viewBox={`0 0 ${width} ${height}`} width={fit||compact?'100%':width} style={fit||compact?undefined:{minWidth:width}} role="img" aria-label={'淘汰赛对阵图'+(champion?'，冠军 '+teamName(champion):'')}>
    <text className="draw-champion" x={half} y={18} textAnchor="middle">{champion?'🏆 '+teamName(champion):rounds>1?'决赛':''}</text>
    {lines.map((l,i)=><path key={i} d={l.d} className={'draw-line'+(l.won?' is-won':'')+(l.live?' is-live':'')}/>)}
    {labels.map((l,i)=><text key={i} x={l.x} y={l.y+4} textAnchor={l.anchor} className={'draw-entry'+(l.empty?' is-empty':'')}>{l.anchor==='end'&&l.seed&&<tspan className="draw-seed">{l.seed} </tspan>}{l.text.length>14?l.text.slice(0,13)+'…':l.text}{l.anchor==='start'&&l.seed&&<tspan className="draw-seed"> {l.seed}</tspan>}</text>)}
    {junctions.map(({f,x,y,anchor})=>{const winner=fixtureWinner(t,data,f),s=score(f);return <g key={f.id} className={'draw-junction'+(selected===f.id?' is-selected':'')+(playing(f)?' is-live':'')} onClick={()=>pick(f)}>
     <rect x={anchor==='start'?x-colW:x} y={y-13} width={colW} height={26} rx={6}/>
     {winner&&f.id!==final.id&&<text x={anchor==='start'?x+4:x-4} y={y-5} textAnchor={anchor} className="draw-winner">{teamName(winner).slice(0,8)}</text>}
     {s&&<text x={anchor==='start'?x+4:x-4} y={y+12} textAnchor={anchor} className="draw-score">{s}</text>}
    </g>})}
    <g className={'draw-junction is-final'+(selected===final.id?' is-selected':'')+(playing(final)?' is-live':'')} onClick={()=>pick(final)}><circle cx={half} cy={fy} r={7}/>{score(final)&&<text x={half} y={fy+22} textAnchor="middle" className="draw-score">{score(final)}</text>}</g>
   </svg>
  </div>
 </div>;
}
