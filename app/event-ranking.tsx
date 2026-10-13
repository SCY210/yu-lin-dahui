'use client';
import {eventHasStartedMatches,eventRankingEnabled} from '../lib/domain/event-ranking';
import type {Event} from '../lib/domain/types';
import type {SchedulingContext} from './event-scheduling';
import {useActivityClock} from '../lib/client/use-activity-clock';

export default function EventRanking({e,ctx}:{e:Event;ctx:SchedulingContext}){
 const now=useActivityClock(e),enabled=eventRankingEnabled(e),admin=ctx.data.me.role==='admin'||ctx.data.me.isOwner;
 const editable=admin&&!ctx.readOnly&&now<e.end&&!['ended','cancelled'].includes(e.status)&&!eventHasStartedMatches(ctx.data,e);
 return <section className="card event-ranking"><div className="row"><strong>{enabled?'积分赛':'普通活动'}</strong>{editable&&<button type="button" className="secondary" disabled={ctx.busy} onClick={()=>ctx.open(enabled?'改为普通活动':'开启积分赛','eventRanking',{eventId:e.id,ranked:!enabled,expectedRanked:enabled},[],undefined,enabled?'改为普通接龙和分组，对局不计积分或修为。':'开启后本活动的对局计入积分榜和修为；开打后不能变更。')}>{enabled?'改为普通活动':'开启积分赛'}</button>}</div><p className="hint">{enabled?'本活动由群主或管理员开启积分赛，对局按规则计入积分与修为。':'接龙、分组和录分照常使用，对局、MVP 和迟到均不加减积分或修为。'}</p></section>;
}
