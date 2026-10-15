import type {Event} from './types';

const minute=60000;
export function defaultPointsMinutes(e:Pick<Event,'start'|'end'>){return Math.max(0,Math.floor((e.end-e.start)/minute))}
export function pointsWindow(e:Event){return e.pointsPlan??{start:e.start,end:e.start+defaultPointsMinutes(e)*minute,roundMinutes:15}}
export function isPointsTime(e:Event,at:number){return !e.pointsPlan||(at>=e.pointsPlan.start&&at<e.pointsPlan.end)}
/** The planPoints input that plans the rest of an activity when it starts without a planned schedule: from the next
 * whole minute (never before its start) until the points window ends, keeping its round length and partner mode.
 * Starting at the next minute keeps a signup made a moment ago from opening a phase shorter than five minutes. */
export function automaticPlanInput(e:Event,singles:boolean,now:number){
 const window=pointsWindow(e),at=Math.max(e.start,window.start,Math.ceil(now/minute)*minute),pointsMinutes=Math.min(720,Math.floor((Math.min(e.end,Math.max(window.end,at))-at)/minute));
 return pointsMinutes<5?null:{eventId:e.id,at,pointsMinutes,roundMinutes:window.roundMinutes,seed:now%2147483646+1,pairing:singles?'rotate' as const:e.pointsChoice?.selectedMode??'rotate'};
}
