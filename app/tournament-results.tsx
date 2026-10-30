'use client';
import {Archive,Trophy} from 'lucide-react';
import type {Event} from '../lib/domain/types';
import {categoryLabels,formatLabels,tournamentFormat,type Tournament} from '../lib/domain/tournament';
import {tournamentResults,type TournamentArchive} from '../lib/domain/tournament-results';
import type {SchedulingContext} from './event-scheduling';
import './tournament-results.css';

type Row=TournamentArchive['results'][number];
const medals=['🥇','🥈','🥉'];

/** Final places and records (lib/domain/tournament-results.ts), computed as soon as the champion is known. Once
 * archived, the frozen copy is shown, so later renames or edits never change a past competition. */
export default function TournamentResults({e,ctx,manager}:{e:Event;ctx:SchedulingContext;manager:boolean}){
 const t=e.tournament!,live=t.archive?null:tournamentResults(t,ctx.data);
 const rows:Row[]|null=t.archive?.results??live?.map(r=>({...r,players:r.players.map(id=>({id,name:ctx.name(id)}))}))??null;
 if(!rows)return null;
 const team=(r:Row)=>r.players.map(p=>p.name).join(' / ');
 return <section className="card tournament-results">
  <div className="row"><h2><Trophy size={20}/> 成绩与排名</h2>{t.archive&&<span className="badge">已归档</span>}</div>
  <ol className="tournament-podium">{rows.filter(r=>r.place<=3).map(r=><li key={r.teamId} className={'is-place-'+r.place}><span aria-hidden="true">{medals[r.place-1]}</span><strong>{r.label}</strong><span>{team(r)}</span></li>)}</ol>
  <div className="tournament-table-scroll"><table className="tournament-table"><caption>全部名次</caption><thead><tr><th>名次 / 队伍</th><th>场</th><th>胜</th><th>负</th><th>局</th><th>得失分</th></tr></thead><tbody>{rows.map(r=><tr key={r.teamId}><th scope="row">{r.label} · {team(r)}</th><td>{r.played}</td><td>{r.wins}</td><td>{r.losses}</td><td>{r.gamesWon}:{r.gamesLost}</td><td>{r.pointsFor}:{r.pointsAgainst}</td></tr>)}</tbody></table></div>
  {manager&&<div className="actions">{t.archive
   ?<button type="button" className="ghost" disabled={ctx.busy} onClick={()=>ctx.send('tournamentArchive',{eventId:e.id,archived:false})}>取消归档</button>
   :<button type="button" className="primary" disabled={ctx.busy} onClick={()=>ctx.send('tournamentArchive',{eventId:e.id,archived:true})}><Archive size={16}/>一键归档到往届比赛</button>}</div>}
  {manager&&!t.archive&&<p className="hint">归档后成绩和名字按现在的样子保存，比赛出现在「活动 → 往届比赛」，随时可看；对战表不能再改，需要修改时可取消归档。</p>}
 </section>;
}

/** Archived competitions, newest first, on the activities page. */
export function PastTournaments({events,onOpen}:{events:Event[];onOpen:(id:string)=>void}){
 const past=events.filter(e=>e.tournament?.archive&&e.deletedAt===undefined).sort((a,b)=>b.start-a.start);
 if(!past.length)return null;
 const day=new Intl.DateTimeFormat('zh-CN',{timeZone:'Europe/Madrid',year:'numeric',month:'numeric',day:'numeric'});
 const champion=(t:Tournament)=>t.archive!.results.filter(r=>r.place===1).map(r=>r.players.map(p=>p.name).join(' / ')).join('、');
 return <section className="event-group past-tournaments"><div className="section-title"><h2>往届比赛</h2><span className="badge">{past.length}</span></div>
  {past.map(e=>{const t=e.tournament!;return <button type="button" key={e.id} className="past-tournament" onClick={()=>onOpen(e.id)}>
   <span className="past-tournament-title"><strong>{e.title}</strong><small>{day.format(e.start)} · {formatLabels[tournamentFormat(t)]}{t.category?' · '+categoryLabels[t.category]:''} · {t.teams.length} 队</small></span>
   <span className="past-tournament-champion">🏆 {champion(t)}</span>
  </button>})}
 </section>;
}
