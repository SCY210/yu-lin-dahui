import {z} from 'zod';
import {parseDomainCommand} from './command-contract';
import {awardVotingClosesAt,mvpPointAdjustments} from './activity-voting';
import {pointGrants} from './point-grants';
import {fail,type Account,type State} from './types';

/** Extra points are announced for this long; older ones are not brought up again. */
export const bonusNoticeDays=14;
export type BonusNotice={id:string;kind:'mvp'|'grant';points:number;at:number;title:string};

/** Extra season points this member received and has not acknowledged yet: MVP awards and positive owner grants. */
export function bonusNotices(s:Pick<State,'events'|'awardVotes'|'audits'>,a:Pick<Account,'playerId'|'bonusSeen'>,now:number):BonusNotice[]{
 const seen=new Set(a.bonusSeen??[]),since=now-bonusNoticeDays*86400000,events=new Map(s.events.map(e=>[e.id,e]));
 const mvp=mvpPointAdjustments(s,now).filter(g=>g.playerId===a.playerId).map(g=>{const e=events.get(g.eventId)!;return {id:'mvp:'+e.id,kind:'mvp' as const,points:g.delta,at:awardVotingClosesAt(e),title:e.title}});
 const grants=pointGrants(s).filter(g=>g.playerId===a.playerId&&g.points>0).map(g=>({id:'grant:'+g.id,kind:'grant' as const,points:g.points,at:g.at,title:g.reason}));
 return [...mvp,...grants].filter(n=>n.at>=since&&n.at<=now&&!seen.has(n.id)).sort((x,y)=>x.at-y.at||x.id.localeCompare(y.id));
}

const schemas={bonusSeen:z.object({ids:z.array(z.string().min(1).max(200)).min(1).max(50)})};
/** "我是最棒哒！": remember the acknowledged notices on the member's own account. */
export async function applyBonusSeen(s:State,a:Account,action:string,input:unknown){
 const command=parseDomainCommand(schemas,action,input);if(!command)return false;
 const account=s.accounts.find(x=>x.id===a.id)??fail('账号不存在');
 account.bonusSeen=[...new Set([...(account.bonusSeen??[]),...command.payload.ids])].slice(-300);
 return true;
}
