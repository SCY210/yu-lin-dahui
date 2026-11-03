'use client';
import {canManageRankedEvent,eventHasStartedMatches,eventRankingEnabled} from '../lib/domain/event-ranking';
import type {Event} from '../lib/domain/types';
import type {SchedulingContext} from './event-scheduling';
import {useActivityClock} from '../lib/client/use-activity-clock';

/** The points-match switch, a button beside the rounds tab's guides (app/event-view.tsx). Only those who may change it,
 * before the first game starts, see it; the header's points-match seal shows the current state to everyone. */
export default function EventRankingToggle({e,ctx}:{e:Event;ctx:SchedulingContext}){
 const now=useActivityClock(e),enabled=eventRankingEnabled(e),admin=canManageRankedEvent(ctx.data.me,e);
 const editable=admin&&!ctx.readOnly&&now<e.end&&!['ended','cancelled'].includes(e.status)&&!eventHasStartedMatches(ctx.data,e);
 if(!editable)return null;
 return <button type="button" className="event-ranking-toggle" disabled={ctx.busy} onClick={()=>ctx.open(enabled?'改为普通活动':'开启积分赛','eventRanking',{eventId:e.id,ranked:!enabled,expectedRanked:enabled},[],undefined,enabled?'改为普通接龙和分组，对局不计积分或修为。':'开启后本活动的对局计入积分榜和修为；开打后不能变更。')}>{enabled?'改为普通活动':'开启积分赛'}</button>;
}
