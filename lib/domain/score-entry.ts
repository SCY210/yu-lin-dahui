import type {Match,State} from './types';
import {isPlannedLineup} from './round-lineup';

export function scoreEntryStart(m:Pick<Match,'start'|'roundId'|'eventId'>,data:Pick<State,'events'|'rounds'>){
 const event=data.events.find(e=>e.id===m.eventId),round=data.rounds.find(r=>r.id===m.roundId);
 return m.start??Math.max(event?.start??0,round?.start??0);
}
/** Published teams are confirmed, so results do not require a clock-driven start command. */
export function canEnterUnstartedScore(m:Pick<Match,'status'|'start'|'roundId'|'eventId'>,data:Pick<State,'events'|'rounds'>){
 const event=data.events.find(e=>e.id===m.eventId),round=data.rounds.find(r=>r.id===m.roundId);
 return m.status==='published'&&m.start===null&&!!event&&event.deletedAt===undefined&&!['draft','cancelled'].includes(event.status)&&round?.eventId===event.id&&(round.status==='published'||round.status==='playing'&&isPlannedLineup(event,round));
}
/** Scheduled timestamps stay in their activity; only a server-recorded early result bypasses the future-end guard. */
export function scoreRecordedBy(m:Pick<Match,'start'|'end'|'earlyScoreAt'>,now:number){
 if(m.end===null||!Number.isFinite(m.end))return false;
 if(m.end<=now)return true;
 return m.start!==null&&m.end>m.start&&typeof m.earlyScoreAt==='number'&&Number.isFinite(m.earlyScoreAt)&&m.earlyScoreAt>=0&&m.earlyScoreAt<=now&&m.earlyScoreAt<m.start;
}
