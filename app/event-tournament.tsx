'use client';
import {useState} from 'react';
import type {Event} from '../lib/domain/types';
import {canScheduleEvent} from '../lib/domain/permissions';
import {eventStatusAt} from '../lib/domain/event-lifecycle';
import {useActivityClock} from '../lib/client/use-activity-clock';
import {eventFormat} from '../lib/domain/match-format';
import {groupStandings,groupComplete,fixtureSides,fixtureWinner,tournamentChampion,tournamentFormat,formatLabels,categoryName,type TournamentFixture} from '../lib/domain/tournament';
import {balancedPairs} from '../lib/domain/tournament-pairing';
import TournamentSettings from './tournament-settings';
import TournamentResults from './tournament-results';
import RefereeConsole from './referee-console';
import LiveScoreboard from './live-scoreboard';
import type {SchedulingContext} from './event-scheduling';
import MatchCard from './match-card';
import TournamentBracket from './tournament-bracket';
import Disclosure from './disclosure';
import {choice} from './form-fields';
import './event-tournament.css';
import {matchIncludesPlayer} from '../lib/client/match-player-filter';

export default function EventTournament({e,ctx}:{e:Event;ctx:SchedulingContext}){
 const now=useActivityClock(e),t=e.tournament!,{data,name,busy,open}=ctx;
 const playerId=ctx.matchPlayerId??'';
 const matchesFilter=(f:TournamentFixture)=>{
  if(!playerId)return true;
  const match=data.matches.find(m=>m.id===f.matchId);
  if(match)return matchIncludesPlayer(match,playerId);
  const sides=fixtureSides(t,data,f);
  return t.teams.some(team=>(team.id===sides.a||team.id===sides.b)&&team.players.includes(playerId));
 };
 const manager=!ctx.readOnly&&canScheduleEvent(data.me,e),active=!['ended','cancelled','draft'].includes(eventStatusAt(e,now));
 const singles=eventFormat(e)==='singles',format=tournamentFormat(t),organiser=!ctx.readOnly&&(data.me.role==='admin'||!!data.me.isOwner);
 const realm=(id:string)=>data.social?.stats?.find(row=>row.playerId===id)?.realmScore?.score??1000;
 const genderOf=(id:string)=>{const p=data.players.find(p=>p.id===id),g=p?.profile?.gender??p?.guestGender;return typeof g==='string'?g:undefined};
 const strength=(team:string[])=>team.reduce((sum,id)=>sum+realm(id),0);
 // Men's categories only offer men; the draw checks every team again (categoryProblem).
 const signedUp=data.registrations.filter(r=>r.eventId===e.id&&r.status==='confirmed'&&data.players.some(p=>p.id===r.playerId&&p.enabled)).slice().sort((a,b)=>a.sequence-b.sequence).map(r=>r.playerId);
 const mensOnly=t.category==='mens-singles'||t.category==='mens-doubles',eligible=mensOnly?signedUp.filter(id=>genderOf(id)==='male'):signedUp,excluded=signedUp.filter(id=>!eligible.includes(id));
 const [selected,setSelected]=useState<string[]>(eligible),[pairs,setPairs]=useState<string[][]>([]),[groups,setGroups]=useState(2),[advance,setAdvance]=useState(2),[unpaired,setUnpaired]=useState<string[]>([]);
 // Balanced partners by 修为 (lib/domain/tournament-pairing.ts); the selects below stay editable afterwards.
 const autoPair=()=>{const result=balancedPairs(eligible.map(id=>({id,score:realm(id),gender:genderOf(id)})),t.category);setPairs(result.teams);setUnpaired(result.left)};
 const label=(id:string|null|undefined)=>id? t.teams.find(x=>x.id===id)?.players.map(name).join(' / ')??'待定':'轮空';
 const [selectedFixture,setSelectedFixture]=useState(''),[refereeMatch,setRefereeMatch]=useState(''),[board,setBoard]=useState(false);
 // Any enabled member who does not play in the fixture can referee it (lib/domain/tournament-commands.ts).
 const refereeChoices=(playing:string[])=>data.players.filter(p=>p.enabled&&!p.guestEventId&&!playing.includes(p.id)).map(p=>p.id);
 const selectedMatch=t.fixtures.find(f=>f.stage==='knockout'&&f.id===selectedFixture)??t.fixtures.find(f=>f.stage==='knockout'&&data.matches.some(m=>m.id===f.matchId&&m.status==='playing'));
 const champion=tournamentChampion(t,data),started=t.fixtures.some(f=>f.matchId);
 const teams=singles?selected.filter(id=>eligible.includes(id)).map(id=>[id]):pairs;
 const sized=format==='groups'?teams.length>=4&&groups*2<=teams.length&&advance<=Math.floor(teams.length/groups):teams.length>=2&&teams.length<=(format==='round-robin'?16:32);
 const valid=sized&&teams.length<=32&&teams.every(team=>team.length===(singles?1:2)&&team.every(id=>eligible.includes(id)))&&new Set(teams.flat()).size===teams.flat().length;
 const drawText={groups:'将随机分组并生成每组循环赛。',knockout:'按修为从高到低排种子并生成淘汰赛签表。','round-robin':'将生成所有队伍之间的循环赛。'}[format];
 // A knockout is seeded by team 修为, strongest first; the other formats are drawn at random on the server.
 const draw=()=>open(started?'赛事抽签':'抽签并生成对战表','tournamentDraw',{eventId:e.id,teams:format==='knockout'?[...teams].sort((x,y)=>strength(y)-strength(x)):teams,groups,advance,seed:Math.floor(Math.random()*2147483646)+1,seeded:format==='knockout'},[],undefined,drawText+'每人只能参加一队；双打搭档全程固定。'+(t.phase!=='setup'?'重新抽签会替换尚未开打的对战表。':''));
 const start=(f:TournamentFixture)=>open('安排本场比赛','tournamentStart',{eventId:e.id,fixtureId:f.id,courtId:data.bookings.find(b=>b.eventId===e.id&&b.start<=now&&b.end>now)?.id??''},[choice('courtId','使用场地',data.bookings.filter(b=>b.eventId===e.id&&b.start<=now&&b.end>now).map(b=>[b.id,b.name]))],undefined,'开赛时间自动记录；当前双方必须都在正式参加时段内，且没有其他正在进行的对局。');
 const fixture=(f:TournamentFixture)=>{
  const sides=fixtureSides(t,data,f),m=data.matches.find(m=>m.id===f.matchId),winner=fixtureWinner(t,data,f);
  const source=(id:string|undefined)=>{const prev=t.fixtures.find(x=>x.id===id);return prev?'第 '+prev.round+' 轮 · 第 '+(prev.slot+1)+' 场胜者':'待晋级'};
  return <article key={f.id} className={'tournament-match '+(m?.status==='playing'?'is-playing':'')}>
   <div className="row"><strong>{f.stage==='group'?'小组第 '+f.round+' 轮':'第 '+(f.slot+1)+' 场'}</strong><span className="badge">{m?.status==='playing'?'正在比赛':m?.status==='complete'?'已完成':winner?'轮空晋级':sides.a&&sides.b?'待开赛':'等待晋级'}</span></div>
   <div className="tournament-opponents"><span className={winner===sides.a?'winner':''}>{sides.a===undefined?source(f.fromA):label(sides.a)}</span><b>{m?.scoreA!=null?m.scoreA+' : '+m.scoreB:'VS'}</b><span className={winner===sides.b?'winner':''}>{sides.b===undefined?source(f.fromB):label(sides.b)}</span></div>
   {manager&&active&&!m&&sides.a&&sides.b&&<button type="button" className="secondary" disabled={busy||now<e.start} onClick={()=>start(f)}>安排开赛</button>}
   {(f.referee||manager&&active)&&<div className="tournament-referee">{manager&&active&&m?.status!=='complete'?<label>裁判<select value={f.referee??''} disabled={busy} onChange={event=>ctx.send('tournamentReferee',{eventId:e.id,fixtureId:f.id,playerId:event.target.value||null})}><option value="">未指定</option>{refereeChoices(t.teams.filter(team=>team.id===sides.a||team.id===sides.b).flatMap(team=>team.players)).map(id=><option key={id} value={id}>{name(id)}</option>)}</select></label>:<span>裁判 · {name(f.referee!)}</span>}</div>}
   {m&&m.status==='playing'&&!ctx.readOnly&&(manager||f.referee===data.me.playerId)&&<button type="button" className="primary" onClick={()=>setRefereeMatch(m.id)}>裁判记分</button>}
   {m&&<Disclosure label={m.status==='playing'?'录入本场比分':'查看赛果 / 修正比分'} defaultOpen={m.status==='playing'}><MatchCard m={m} ctx={{...ctx,readOnly:ctx.readOnly||f.stage==='group'&&t.phase==='knockout'}}/></Disclosure>}
  </article>;
 };
 return <div className="event-tournament">
  <section className="card"><p className="eyebrow">{categoryName(t,singles)+(singles?' 比赛':' · 固定搭档')}</p><h2>{formatLabels[format]}</h2><p className="hint">{format==='groups'?<>先打组内单循环，每组前 {t.phase==='setup'?advance:t.advance} 名晋级。小组按胜场、净胜分、总得分排序；完全同分按抽签顺序。淘汰赛按小组名次交叉安排，人数不足整签位时自动轮空。</>:format==='knockout'?'单败淘汰，按修为排种子，种子队在签位不足时轮空。':'所有队伍互相打一场，按胜场、净胜分、总得分排名；完全同分按抽签顺序。'}单打和双打战绩分别进入各自榜单。</p>{champion&&<p className="tournament-champion">🏆 冠军 · {label(champion)}</p>}{t.phase!=='setup'&&<button type="button" className="secondary" onClick={()=>setBoard(true)}>实时比分大屏</button>}
  </section>
  <TournamentResults e={e} ctx={ctx} manager={!ctx.readOnly&&canScheduleEvent(data.me,e)}/>
  <TournamentSettings key={e.id+':'+t.phase+':'+(t.fee??'')} e={e} ctx={ctx} organiser={organiser}/>
  {manager&&active&&!started&&<Disclosure label={t.phase==='setup'?'选择参赛者与分组':'重新抽签（尚未开打）'} defaultOpen={t.phase==='setup'}>
   <section className="card tournament-setup"><h3>{singles?'选择正式报名的参赛者':'指定双打固定搭档'}</h3><p className="hint">至少 4 {singles?'位选手':'组搭档'}，最多 32 {singles?'位选手':'组搭档'}。请先在活动接龙完成正式报名。</p>{excluded.length>0&&<p className="hint">{categoryName(t,singles)}只限男球友，未列出：{excluded.map(name).join('、')}（资料性别不是男或未填写）。</p>}
    {singles?<div className="tournament-entrants">{eligible.map(id=><label key={id}><input type="checkbox" checked={selected.includes(id)} onChange={event=>setSelected(event.target.checked?[...selected,id]:selected.filter(x=>x!==id))}/>{name(id)}</label>)}</div>:<><div className="tournament-pairs">{pairs.map((pair,index)=><div key={index} className="tournament-pair"><strong>队伍 {index+1}</strong>{pair.map((value,side)=><select key={side} aria-label={'队伍 '+(index+1)+' 球友 '+(side+1)} value={value} onChange={event=>setPairs(pairs.map((p,i)=>i===index?p.map((id,j)=>j===side?event.target.value:id):p))}><option value="">选择球友</option>{eligible.filter(id=>id===value||!pairs.flat().includes(id)).map(id=><option key={id} value={id}>{name(id)}</option>)}</select>)}<button type="button" className="ghost" aria-label={'移除队伍 '+(index+1)} onClick={()=>setPairs(pairs.filter((_,i)=>i!==index))}>移除</button></div>)}</div><div className="actions"><button type="button" className="secondary" disabled={eligible.length<2} onClick={autoPair}>按修为自动平衡分配</button><button type="button" className="secondary" disabled={pairs.length>=32} onClick={()=>setPairs([...pairs,['','']])}>添加双打队伍</button></div>{unpaired.length>0&&<p className="hint">暂未配对：{unpaired.map(name).join('、')}{t.category==='mixed-doubles'?'（男女人数不等或资料未填性别）':''}，可手动调整。</p>}<p className="hint">自动分配让最强和最弱的搭档，再交换队员使各队修为总和尽量接近；分配后仍可逐队修改。</p></>}
    {format==='groups'&&<div className="tournament-options"><label>小组数量<select value={groups} onChange={event=>setGroups(Number(event.target.value))}>{[2,3,4,5,6,7,8].map(n=><option key={n} value={n}>{n} 组</option>)}</select></label><label>每组晋级<select value={advance} onChange={event=>setAdvance(Number(event.target.value))}>{[1,2,3,4].map(n=><option key={n} value={n}>{n} 名</option>)}</select></label></div>}
    <p className="hint">已选择 {teams.length} {singles?'位选手':'支队伍'} · {format==='groups'?'至少 4 队，每组至少 2 队，晋级名额不能超过最小组人数。':format==='round-robin'?'2 到 16 队。':'至少 2 队，最多 32 队。'}</p><button type="button" className="primary" disabled={busy||!valid} onClick={draw}>{format==='groups'?'抽签并生成小组赛':format==='knockout'?'排种子并生成淘汰赛':'生成循环赛对战表'}</button>
   </section>
  </Disclosure>}
  {t.phase==='setup'&&!manager&&<p className="empty">等待创建者指定参赛队伍并抽签。你可以先在活动接龙报名。</p>}
  {playerId&&t.phase!=='setup'&&!t.fixtures.some(matchesFilter)&&<p className="match-filter-empty">这位球友暂时没有已确定的对局。</p>}
  {t.groups.map((group,index)=>playerId&&!t.fixtures.some(f=>f.stage==='group'&&f.group===index&&matchesFilter(f))?null:<Disclosure key={index+':'+t.phase+':'+playerId} label={(format==='round-robin'?'循环赛':String.fromCharCode(65+index)+' 组')+' · '+group.length+' '+(singles?'人':'队')} defaultOpen={!!playerId||t.phase==='groups'}><section className="tournament-group"><div className="tournament-table-scroll"><table className="tournament-table"><caption>{format==='round-robin'?'循环赛':String.fromCharCode(65+index)+' 组'}排名</caption><thead><tr><th>名次 / 队伍</th><th>场</th><th>胜</th><th>负</th><th>净胜</th></tr></thead><tbody>{groupStandings(t,data,index).map((row,i)=><tr key={row.id} className={format==='groups'&&i<t.advance?'qualifying':''}><th scope="row">{i+1}. {label(row.id)}{format==='groups'&&i<t.advance&&<small>晋级区</small>}</th><td>{row.played}</td><td>{row.wins}</td><td>{row.losses}</td><td>{row.difference}</td></tr>)}</tbody></table></div><div className="tournament-fixtures">{t.fixtures.filter(f=>f.stage==='group'&&f.group===index&&matchesFilter(f)).map(fixture)}</div></section></Disclosure>)}
  {manager&&active&&format==='groups'&&t.phase==='groups'&&<section className="card"><button type="button" className="primary" disabled={busy||!groupComplete(t,data)} onClick={()=>open('确认晋级名单并生成淘汰赛','tournamentKnockout',{eventId:e.id},[],undefined,'按当前小组排名取各组前 '+t.advance+' 名。请先核对比分；生成后小组赛比分封存。')}>生成淘汰赛对战表</button><p className="hint">全部小组赛录分完成后开放。</p></section>}
  {t.phase==='knockout'&&<section className="card"><div className="row"><h2>淘汰赛对战表</h2>{manager&&active&&format==='groups'&&!t.fixtures.some(f=>f.stage==='knockout'&&f.matchId)&&<button type="button" className="ghost" disabled={busy} onClick={()=>open('返回小组赛','tournamentReopen',{eventId:e.id},[],undefined,'清除尚未开打的淘汰赛签位，保留所有小组赛比分，可修正后重新生成晋级名单。')}>返回小组赛</button>}</div>{playerId?<div className="tournament-fixtures">{t.fixtures.filter(f=>f.stage==='knockout'&&matchesFilter(f)).map(fixture)}</div>:<TournamentBracket t={t} data={data} name={name} selected={selectedMatch?.id} onSelect={f=>setSelectedFixture(f.id)}/>} {!playerId&&selectedMatch&&<div className="tournament-selected-match"><h3>所选对局 · {selectedMatch.round===Math.max(...t.fixtures.filter(f=>f.stage==='knockout').map(f=>f.round))?'决赛':'淘汰赛第 '+selectedMatch.round+' 轮'}</h3>{fixture(selectedMatch)}</div>}</section>}
  {refereeMatch&&data.matches.some(m=>m.id===refereeMatch)&&<RefereeConsole e={e} m={data.matches.find(m=>m.id===refereeMatch)!} ctx={ctx} close={()=>setRefereeMatch('')}/>}
  {board&&<LiveScoreboard e={e} ctx={ctx} close={()=>setBoard(false)}/>}
 </div>;
}
