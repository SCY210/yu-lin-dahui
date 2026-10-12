import {z} from 'zod';
import {activityNoticeSnapshot,activityNoticeVersion} from '../activity-notice';
import type {Account,AccountNoticeReceipt,State} from './types';
import {fail} from './types';

export type NoticeContent={version:string;contentHash:string;contentSnapshot:string};
export async function noticeContent():Promise<NoticeContent>{
 const contentSnapshot=activityNoticeSnapshot();
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(contentSnapshot));
 return {version:activityNoticeVersion,contentSnapshot,contentHash:Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('')};
}
export function accountNoticeView(s:State,a:Account,content:NoticeContent){
 const receipts=(s.accountNoticeReceipts??[]).filter(r=>r.accountId===a.id).sort((x,y)=>y.acceptedAt-x.acceptedAt);
 const current=receipts.find(r=>r.version===content.version&&r.contentHash===content.contentHash&&r.contentSnapshot===content.contentSnapshot);
 return {required:!current,currentVersion:content.version,contentHash:content.contentHash,acceptedAt:current?.acceptedAt??null,receipts};
}
export function requiresAccountNotice(s:State,a:Account,content:NoticeContent){return accountNoticeView(s,a,content).required}
export function noticeGateResponse(s:State,a:Account,content:NoticeContent){
 return Response.json({error:'请先阅读并主动同意活动参与须知与风险提示',noticeRequired:true,accountNotice:accountNoticeView(s,a,content)},{status:428,headers:{'Cache-Control':'no-store'}});
}
export function acknowledgeAccountNotice(s:State,a:Account,input:unknown,now:number,content:NoticeContent):AccountNoticeReceipt{
 const p=z.object({noticeAccepted:z.literal(true),noticeVersion:z.string(),noticeHash:z.string()}).strict().parse(input);
 if(p.noticeVersion!==content.version||p.noticeHash!==content.contentHash)fail('409: 须知已更新，请刷新后重新阅读并确认');
 const existing=(s.accountNoticeReceipts??[]).find(r=>r.accountId===a.id&&r.version===content.version&&r.contentHash===content.contentHash);
 if(existing)return existing;
 if(!Number.isSafeInteger(now)||now<0)fail('确认时间无效');
 const receipt:AccountNoticeReceipt={id:crypto.randomUUID(),accountId:a.id,playerId:a.playerId,version:content.version,contentHash:content.contentHash,contentSnapshot:content.contentSnapshot,acceptedAt:now,method:'explicit-account-confirmation'};
 s.accountNoticeReceipts??=[];s.accountNoticeReceipts.push(receipt);
 return receipt;
}
