'use client';
import {useRef,useState} from 'react';
import {Trophy,ZoomIn,ZoomOut,Maximize2} from 'lucide-react';
import type {Tournament,TournamentFixture,TournamentData} from '../lib/domain/tournament';
import {fixtureSides,fixtureWinner} from '../lib/domain/tournament';
import {tournamentBracketLayout,bracketCard} from '../lib/client/tournament-bracket-layout';
import './tournament-bracket.css';

type Props={t:Tournament;data:TournamentData;name:(id:string)=>string;selected?:string;onSelect:(f:TournamentFixture)=>void};
export default function TournamentBracket({t,data,name,selected,onSelect}:Props){
 const viewport=useRef<HTMLDivElement>(null),[scale,setScale]=useState(1),layout=tournamentBracketLayout(t.fixtures);
 const team=(id:string|null|undefined,source:string|undefined)=>id?t.teams.find(team=>team.id===id)?.players.map(name)??['待定']:id===undefined?[source?(()=>{const f=t.fixtures.find(f=>f.id===source);return f?'第 '+f.round+' 轮第 '+(f.slot+1)+' 场胜者':'待晋级'})():'待晋级']:['轮空'];
 const fit=()=>setScale(Math.max(.05,Math.min(1,((viewport.current?.clientWidth??900)-16)/layout.width)));
 return <div className="knockout-chart">
  <div className="knockout-tools"><p className="hint">左右两侧逐轮晋级，在中间会师决赛。点击对局查看详情；手机可横向滑动。</p><div className="actions" role="group" aria-label="对战表缩放"><button type="button" className="secondary" aria-label="缩小对战表" disabled={scale<=.2} onClick={()=>setScale(Math.max(.2,scale-.2))}><ZoomOut size={16}/></button><span aria-live="polite">{Math.round(scale*100)}%</span><button type="button" className="secondary" aria-label="放大对战表" disabled={scale>=1.4} onClick={()=>setScale(Math.min(1.4,scale+.2))}><ZoomIn size={16}/></button><button type="button" className="secondary" onClick={fit}><Maximize2 size={16}/>全图</button><button type="button" className="ghost" onClick={()=>setScale(1)}>原大</button></div></div>
  <div className="knockout-viewport" ref={viewport} role="region" aria-label="淘汰赛树状对战表，可横向滚动" tabIndex={0}>
   <div className="knockout-size" style={{width:layout.width*scale,height:layout.height*scale}}><div className="knockout-canvas" style={{width:layout.width,height:layout.height,transform:`scale(${scale})`}}>
    <svg className="knockout-lines" width={layout.width} height={layout.height} aria-hidden="true">{layout.links.map(link=><path key={link.from+':'+link.to} d={link.path}/>)}</svg>
    {layout.nodes.filter((node,i,all)=>all.findIndex(n=>n.x===node.x)===i).map(node=><h3 className={'knockout-column-title '+(node.side==='final'?'is-final':'')} key={node.x} style={{left:node.x,width:bracketCard.width}}>{node.side==='final'&&<Trophy size={22}/>} {node.label}</h3>)}
    {layout.nodes.map(node=>{const f=node.fixture,{a,b}=fixtureSides(t,data,f),winner=fixtureWinner(t,data,f),m=data.matches.find(m=>m.id===f.matchId),namesA=team(a,f.fromA),namesB=team(b,f.fromB);
     return <button type="button" key={f.id} className={'knockout-node '+(node.side==='final'?'is-final ':'')+(m?.status==='playing'?'is-playing ':'')+(selected===f.id?'is-selected':'')} style={{left:node.x,top:node.y,width:bracketCard.width,height:bracketCard.height}} onClick={()=>onSelect(f)} aria-label={node.label+' 第'+(f.slot+1)+'场：'+namesA.join(' / ')+' 对 '+namesB.join(' / ')} aria-pressed={selected===f.id}>
      <span className="knockout-node-status">{m?.status==='playing'?'● 正在比赛':m?.status==='complete'?'已完成':winner?'轮空晋级':a&&b?'待开赛':'等待晋级'}<small>第 {f.slot+1} 场</small></span>
      {([{id:a,names:namesA,score:m?.scoreA},{id:b,names:namesB,score:m?.scoreB}]).map((side,i)=><span key={i} className={'knockout-team '+(side.id&&winner===side.id?'is-winner':'')}><span>{side.names.map((name,index)=><span key={index}>{name}</span>)}</span><b>{side.score??'—'}</b></span>)}
     </button>;
    })}
   </div></div>
  </div>
 </div>;
}
