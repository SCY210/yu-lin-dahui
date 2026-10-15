import {editableMatchLineup,roundLineupSnapshot,type RoundLineup} from '../domain/round-lineup';
import type {Event,Match,Round} from '../domain/types';

type LineupData={matches:Match[];rounds:Round[];events:Event[]};
type LineupForm={action:string;values:Record<string,unknown>};
/** An open editor is tied to the exact teams it displayed, not the latest global revision. */
export function liveLineupFormChanged(form:LineupForm|null,data:Pick<LineupData,'matches'>&{events?:Event[]}){
 if(form?.action!=='liveLineup')return false;
 const m=data.matches.find(match=>match.id===form.values.matchId);
 if(!m||m.status!=='playing'||m.start===null||m.games.length>0||m.scoreA!==null||m.scoreB!==null
  ||JSON.stringify(m.a)!==JSON.stringify(form.values.expectedA)||JSON.stringify(m.b)!==JSON.stringify(form.values.expectedB))return true;
 if(data.events&&!data.events.some(e=>e.id===m.eventId&&e.deletedAt===undefined&&e.livePlay?.enabled))return true;
 const desired=[form.values.incomingId,...['a0','a1','b0','b1'].map(key=>form.values[key]),
  ...(Array.isArray(form.values.a)?form.values.a:[]),...(Array.isArray(form.values.b)?form.values.b:[])].filter((id):id is string=>typeof id==='string');
 const busy=new Set(data.matches.filter(other=>other.id!==m.id&&other.status==='playing').flatMap(other=>[...other.a,...other.b]));
 return desired.some(id=>busy.has(id));
}
export type RoundSelection={roundId:string;playerId:string;lineup:RoundLineup};
export function currentRoundSelection(selected:RoundSelection|null,data:Pick<LineupData,'matches'|'rounds'>,planned=false){
 if(!selected)return null;
 const round=data.rounds.find(r=>r.id===selected.roundId);
 if(!round||!['draft','published','playing'].includes(round.status))return null;
 const matches=data.matches.filter(m=>m.roundId===round.id);
 if(JSON.stringify(roundLineupSnapshot(matches))!==JSON.stringify(selected.lineup))return null;
 const assigned=matches.find(m=>m.a.includes(selected.playerId)||m.b.includes(selected.playerId));
 if(assigned&&!editableMatchLineup(assigned,planned||round.pointsSlot!==undefined))return null;
 return selected;
}
/** Fast collaboration polling includes published/planned rounds, not just live mode. */
export function fastLineupRefresh(page:string,eventId:string|undefined,tab:string|undefined,data:LineupData|null){
 if(!data)return false;
 if(page==='home')return data.matches.some(m=>m.status==='playing'&&data.events.some(e=>e.id===m.eventId&&['open','locked','live'].includes(e.status)));
 if(page!=='events')return false;
 const event=data.events.find(e=>e.id===eventId);
 return !!event&&!['ended','cancelled'].includes(event.status)&&(!!event.livePlay?.enabled||tab==='rounds'&&data.rounds.some(r=>r.eventId===event.id&&['draft','published','playing'].includes(r.status)));
}
/** Never move an accepted view backwards, including after a successful write. */
export function readBelowRevision(incoming:{revision?:unknown},minimum:number){
 return typeof incoming.revision==='number'&&incoming.revision<minimum;
}
