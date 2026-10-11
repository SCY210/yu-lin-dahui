'use client';
import {useState} from 'react';
import type {Event} from '../lib/domain/types';
import {canManageEvent} from '../lib/domain/permissions';
import {eventStatusAt} from '../lib/domain/event-lifecycle';
import {useActivityClock} from '../lib/client/use-activity-clock';
import {eventFormat} from '../lib/domain/match-format';
import {groupStandings,groupComplete,fixtureSides,fixtureWinner,tournamentChampion,type TournamentFixture} from '../lib/domain/tournament';
import type {SchedulingContext} from './event-scheduling';
import MatchCard from './match-card';
import Disclosure from './disclosure';
import {choice} from './form-fields';
import './event-tournament.css';

export default function EventTournament({e,ctx}:{e:Event;ctx:SchedulingContext}){
 const now=useActivityClock(e),t=e.tournament!,{data,name,busy,open}=ctx;
 const manager=!ctx.readOnly&&canManageEvent(data.me,e),active=!['ended','cancelled','draft'].includes(eventStatusAt(e,now));
 const singles=eventFormat(e)==='singles';
 const eligible=data.registrations.filter(r=>r.eventId===e.id&&r.status==='confirmed'&&data.players.some(p=>p.id===r.playerId&&p.enabled)).slice().sort((a,b)=>a.sequence-b.sequence).map(r=>r.playerId);
 const [selected,setSelected]=useState<string[]>(eligible),[pairs,setPairs]=useState<string[][]>([]),[groups,setGroups]=useState(2),[advance,setAdvance]=useState(2);
 const label=(id:string|null|undefined)=>id? t.teams.find(x=>x.id===id)?.players.map(name).join(' / ')??'待定':'轮空';
 const champion=tournamentChampion(t,data),started=t.fixtures.some(f=>f.matchId);
 const teams=singles?selected.filter(id=>eligible.includes(id)).map(id=>[id]):pairs;
 const valid=teams.length>=4&&teams.length<=32&&teams.every(team=>team.length===(singles?1:2)&&team.every(id=>eligible.includes(id)))&&new Set(teams.flat()).size===teams.flat().length&&groups*2<=teams.length&&advance<=Math.floor(teams.length/groups);
 const draw=()=>open(started?'赛事抽签':'生成小组对战表','tournamentDraw',{eventId:e.id,teams,groups,advance,seed:Math.floor(Math.random()*2147483646)+1},[],undefined,'将随机分组并生成每组循环赛。每人只能参加一队；双打搭档全程固定。'+(t.phase!=='setup'?'重新抽签会替换尚未开打的对战表。':''));
 const start=(f:TournamentFixture)=>open('安排本场比赛','tournamentStart',{eventId:e.id,fixtureId:f.id,courtId:data.bookings.find(b=>b.eventId===e.id&&b.start<=now&&b.end>now)?.id??''},[choice('courtId','使用场地',data.bookings.filter(b=>b.eventId===e.id&&b.start<=now&&b.end>now).map(b=>[b.id,b.name]))],undefined,'开赛时间自动记录；当前双方必须都在正式参加时段内，且没有其他正在进行的对局。');
 const fixture=(f:TournamentFixture)=>{
  const sides=fixtureSides(t,data,f),m=data.matches.find(m=>m.id===f.matchId),winner=fixtureWinner(t,data,f);
  const source=(id:string|undefined)=>{const prev=t.fixtures.find(x=>x.id===id);return prev?'第 '+prev.round+' 轮 · 第 '+(prev.slot+1)+' 场胜者':'待晋级'};
  return <article key={f.id} className={'tournament-match '+(m?.status==='playing'?'is-playing':'')}>
   <div className="row"><strong>{f.stage==='group'?'小组第 '+f.round+' 轮':'第 '+(f.slot+1)+' 场'}</strong><span className="badge">{m?.status==='playing'?'正在比赛':m?.status==='complete'?'已完成':winner?'轮空晋级':sides.a&&sides.b?'待开赛':'等待晋级'}</span></div>
   <div className="tournament-opponents"><span className={winner===sides.a?'winner':''}>{sides.a===undefined?source(f.fromA):label(sides.a)}</span><b>{m?.scoreA!=null?m.scoreA+' : '+m.scoreB:'VS'}</b><span className={winner===sides.b?'winner':''}>{sides.b===undefined?source(f.fromB):label(sides.b)}</span></div>
   {manager&&active&&!m&&sides.a&&sides.b&&<button type="button" className="secondary" disabled={busy||now<e.start} onClick={()=>start(f)}>安排开赛</button>}
   {m&&<Disclosure label={m.status==='playing'?'录入本场比分':'查看赛果 / 修正比分'} defaultOpen={m.status==='playing'}><MatchCard m={m} ctx={{...ctx,readOnly:ctx.readOnly||f.stage==='group'&&t.phase==='knockout'}}/></Disclosure>}
  </article>;
 };
 return <div className="event-tournament">
  <section className="card"><p className="eyebrow">{singles?'单打比赛':'双打比赛 · 固定搭档'}</p><h2>小组赛 → 淘汰赛</h2><p className="hint">先打组内单循环，每组前 {t.phase==='setup'?advance:t.advance} 名晋级。小组按胜场、净胜分、总得分排序；完全同分按抽签顺序。淘汰赛按小组名次交叉安排，人数不足整签位时自动轮空。单打和双打战绩分别进入各自榜单。</p>{champion&&<p className="tournament-champion">🏆 冠军 · {label(champion)}</p>}
  </section>
  {manager&&active&&!started&&<Disclosure label={t.phase==='setup'?'选择参赛者与分组':'重新抽签（尚未开打）'} defaultOpen={t.phase==='setup'}>
   <section className="card tournament-setup"><h3>{singles?'选择正式报名的参赛者':'指定双打固定搭档'}</h3><p className="hint">至少 4 {singles?'位选手':'组搭档'}，最多 32 {singles?'位选手':'组搭档'}。请先在活动接龙完成正式报名。</p>
    {singles?<div className="tournament-entrants">{eligible.map(id=><label key={id}><input type="checkbox" checked={selected.includes(id)} onChange={event=>setSelected(event.target.checked?[...selected,id]:selected.filter(x=>x!==id))}/>{name(id)}</label>)}</div>:<><div className="tournament-pairs">{pairs.map((pair,index)=><div key={index} className="tournament-pair"><strong>队伍 {index+1}</strong>{pair.map((value,side)=><select key={side} aria-label={'队伍 '+(index+1)+' 球友 '+(side+1)} value={value} onChange={event=>setPairs(pairs.map((p,i)=>i===index?p.map((id,j)=>j===side?event.target.value:id):p))}><option value="">选择球友</option>{eligible.filter(id=>id===value||!pairs.flat().includes(id)).map(id=><option key={id} value={id}>{name(id)}</option>)}</select>)}<button type="button" className="ghost" aria-label={'移除队伍 '+(index+1)} onClick={()=>setPairs(pairs.filter((_,i)=>i!==index))}>移除</button></div>)}</div><button type="button" className="secondary" disabled={pairs.length>=32} onClick={()=>setPairs([...pairs,['','']])}>添加双打队伍</button></>}
    <div className="tournament-options"><label>小组数量<select value={groups} onChange={event=>setGroups(Number(event.target.value))}>{[2,3,4,5,6,7,8].map(n=><option key={n} value={n}>{n} 组</option>)}</select></label><label>每组晋级<select value={advance} onChange={event=>setAdvance(Number(event.target.value))}>{[1,2,3,4].map(n=><option key={n} value={n}>{n} 名</option>)}</select></label></div>
    <p className="hint">已选择 {teams.length} {singles?'位选手':'支队伍'} · 每组至少 2 队，晋级名额不能超过最小组人数。</p><button type="button" className="primary" disabled={busy||!valid} onClick={draw}>抽签并生成小组赛</button>
   </section>
  </Disclosure>}
  {t.phase==='setup'&&!manager&&<p className="empty">等待创建者指定参赛队伍并抽签。你可以先在活动接龙报名。</p>}
  {t.groups.map((group,index)=><Disclosure key={index+':'+t.phase} label={String.fromCharCode(65+index)+' 组 · '+group.length+' '+(singles?'人':'队')} defaultOpen={t.phase==='groups'}><section className="tournament-group"><div className="tournament-table-scroll"><table className="tournament-table"><caption>{String.fromCharCode(65+index)} 组排名</caption><thead><tr><th>名次 / 队伍</th><th>场</th><th>胜</th><th>负</th><th>净胜</th></tr></thead><tbody>{groupStandings(t,data,index).map((row,i)=><tr key={row.id} className={i<t.advance?'qualifying':''}><th scope="row">{i+1}. {label(row.id)}{i<t.advance&&<small>晋级区</small>}</th><td>{row.played}</td><td>{row.wins}</td><td>{row.losses}</td><td>{row.difference}</td></tr>)}</tbody></table></div><div className="tournament-fixtures">{t.fixtures.filter(f=>f.stage==='group'&&f.group===index).map(fixture)}</div></section></Disclosure>)}
  {manager&&active&&t.phase==='groups'&&<section className="card"><button type="button" className="primary" disabled={busy||!groupComplete(t,data)} onClick={()=>open('确认晋级名单并生成淘汰赛','tournamentKnockout',{eventId:e.id},[],undefined,'按当前小组排名取各组前 '+t.advance+' 名。请先核对比分；生成后小组赛比分封存。')}>生成淘汰赛对战表</button><p className="hint">全部小组赛录分完成后开放。</p></section>}
  {t.phase==='knockout'&&<section className="card"><div className="row"><h2>淘汰赛对战表</h2>{manager&&active&&!t.fixtures.some(f=>f.stage==='knockout'&&f.matchId)&&<button type="button" className="ghost" disabled={busy} onClick={()=>open('返回小组赛','tournamentReopen',{eventId:e.id},[],undefined,'清除尚未开打的淘汰赛签位，保留所有小组赛比分，可修正后重新生成晋级名单。')}>返回小组赛</button>}</div><div className="tournament-bracket">{[...new Set(t.fixtures.filter(f=>f.stage==='knockout').map(f=>f.round))].map(round=><section key={round} className="tournament-bracket-round"><h3>{round===Math.max(...t.fixtures.filter(f=>f.stage==='knockout').map(f=>f.round))?'决赛':'淘汰赛第 '+round+' 轮'}</h3>{t.fixtures.filter(f=>f.stage==='knockout'&&f.round===round).map(fixture)}</section>)}</div></section>}
 </div>;
}
