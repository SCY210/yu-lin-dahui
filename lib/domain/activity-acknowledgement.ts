import {z} from 'zod';
import {activityNoticeVersion} from '../activity-notice';
import {canManageEvent} from './permissions';
import {fail,type Account,type Registration,type State} from './types';

/** The browser confirms the displayed version; identity and time are server-owned. */
export const activityAcknowledgementInput={noticeAccepted:z.boolean().optional(),noticeVersion:z.string().max(80).optional()};
export function assertActivityAcknowledgement(input:{noticeAccepted?:boolean;noticeVersion?:string}){
 if(input.noticeAccepted!==true)fail('请阅读并勾选同意活动参与须知与风险提示');
 if(input.noticeVersion!==activityNoticeVersion)fail('409: 活动参与须知已更新，请刷新页面后重新打开接龙并阅读确认');
}

/** Only called after a successful manual signup. Automatic queue changes never create consent. */
export function recordActivityAcknowledgement(r:Registration,a:Account,now:number,bookingId?:string){
 const record={id:crypto.randomUUID(),eventId:r.eventId,...(bookingId?{bookingId}:{}),playerId:r.playerId,version:activityNoticeVersion,at:now,actorId:a.id,kind:r.playerId===a.playerId?'self' as const:'proxy' as const};
 (r.noticeAcknowledgements??=[]).push(record);
}

/** Other members cannot inspect an individual's acknowledgement history. */
export function visibleActivityAcknowledgements(s:State,a:Account,r:Registration){
 const event=s.events.find(e=>e.id===r.eventId);
 const records=event&&canManageEvent(a,event)?r.noticeAcknowledgements:r.noticeAcknowledgements?.filter(record=>record.playerId===a.playerId||record.actorId===a.id);
 return records?.map(({actorId,...record})=>{const account=s.accounts.find(account=>account.id===actorId),actorName=s.players.find(player=>player.id===account?.playerId)?.name??'操作球友';return {...record,actorId:'',actorName,actorIsMe:actorId===a.id}});
}
