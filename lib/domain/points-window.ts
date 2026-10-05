import type {Event} from './types';

const minute=60000;
export function defaultPointsMinutes(e:Pick<Event,'start'|'end'>){return Math.max(0,Math.floor((e.end-e.start)/minute)-30)}
export function pointsWindow(e:Event){return e.pointsPlan??{start:e.start,end:e.start+defaultPointsMinutes(e)*minute,roundMinutes:15}}
export function isPointsTime(e:Event,at:number){return !e.pointsPlan||(at>=e.pointsPlan.start&&at<e.pointsPlan.end)}

