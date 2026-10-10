'use client';
import {canManageEvent} from '../lib/domain/permissions';
import {bookingAllowsPlayer} from '../lib/domain/booking-signups';
import {liveAppearances,livePresentIds,liveResting} from '../lib/domain/live-play';
import {liveLineupCandidates} from '../lib/domain/live-lineup';
import type {Account,Event,Match,State} from '../lib/domain/types';
import {openLiveSubstitution,type LineupContext} from './live-lineup-form';
type Context=LineupContext&{data:State&{me:Account};busy:boolean};
export default function LiveCourtBench({e,m,ctx,now}:{e:Event;m:Match;ctx:Context;now:number}){
 const {data,name,busy}=ctx,playing=new Set(data.matches.filter(m=>m.status==='playing').flatMap(m=>[...m.a,...m.b]));
 const bench=livePresentIds(data,e,now).filter(id=>!playing.has(id)&&bookingAllowsPlayer(data,e.id,m.courtId,id,now,now+1));
 const allowed=new Set(liveLineupCandidates(data,e,m,now)),manager=canManageEvent(data.me,e),venue=data.bookings.find(b=>b.id===m.courtId)?.venue??e.venue;
 if(!bench.length)return <p className="hint live-bench-empty">目前没有场下球友。</p>;
 return <section className="live-court-bench" aria-label="场下球友"><h4>场下球友 · {bench.length} 人</h4>{bench.map(id=><div className="live-bench-player" key={id}>
  <div><strong>{name(id)}</strong><small>{liveAppearances(data,e.id,id)} 次上场 · {liveResting(e,id,venue)?'轮休中':'等待上场'}</small></div>
  {manager&&e.livePlay?.enabled&&now<e.end&&!['ended','cancelled','draft'].includes(e.status)&&<button type="button" className="secondary" disabled={busy||!allowed.has(id)} onClick={()=>openLiveSubstitution(e,m,id,ctx)}>{allowed.has(id)?'换上场':'轮休中'}</button>}
 </div>)}</section>;
}
