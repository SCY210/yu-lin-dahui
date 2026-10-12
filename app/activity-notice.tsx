'use client';
import {Checkbox} from '@/components/ui/checkbox';
import {activityNoticeTitle,activityNoticeVersion,activityNoticeVersionLabel,activityNoticeSections,activityNoticeSummary} from '../lib/activity-notice';
import {fmt} from './form-fields';
import './activity-notice.css';

export function ActivityNoticeDetails({defaultOpen=false}:{defaultOpen?:boolean}){
 return <details className="activity-notice" open={defaultOpen||undefined}><summary>{activityNoticeTitle}<span>展开阅读</span></summary><div className="activity-notice-body"><p>{activityNoticeSummary}</p>{activityNoticeSections.map(section=><section key={section.title}><h4>{section.title}</h4><p>{section.body}</p></section>)}<small>须知版本：{activityNoticeVersionLabel}</small><p><a href="/terms" target="_blank" rel="noreferrer">网站说明与使用规则</a> · <a href="/privacy" target="_blank" rel="noreferrer">隐私说明</a></p></div></details>;
}

export default function ActivityNotice({checked,onCheckedChange,proxy=false}:{checked:boolean;onCheckedChange:(checked:boolean)=>void;proxy?:boolean}){
 return <div className="activity-notice-field"><ActivityNoticeDetails/><label className="activity-notice-consent"><Checkbox checked={checked} onCheckedChange={value=>onCheckedChange(value===true)} required aria-label={proxy?'我已阅读并同意活动参与须知，并会告知所代报的球友':'我已阅读并同意活动参与须知与风险提示'}/><span>{proxy?'我已阅读并同意活动参与须知与风险提示，并会将须知告知所代报的球友。':'我已阅读并同意活动参与须知与风险提示。'}</span></label><p className="activity-notice-hint">{proxy?'本次记录由你代报名确认，不代表朋友本人已签署。':'确认时间由服务器记录。'} 未勾选无法保存接龙。</p></div>;
}

type Acknowledgement={id:string;eventId:string;version:string;at:number;bookingId?:string;kind:'self'|'proxy';actorName?:string;actorIsMe?:boolean};
export function ActivityNoticeConfirmation({records,eventId,bookingId}:{records:Acknowledgement[];eventId:string;bookingId:string}){
 const rows=records.filter(record=>record.eventId===eventId&&(!record.bookingId||record.bookingId===bookingId));
 if(!rows.length)return null;
 return <details className="activity-notice-record"><summary>须知确认记录</summary>{rows.slice().reverse().map(record=><p key={record.id}>{record.kind==='proxy'?'代报名人确认':'本人确认'}{record.actorName?' · '+record.actorName+(record.actorIsMe?'（我）':''):''}<br/>{fmt(record.at,{year:'numeric',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'})}<small>版本 {record.version===activityNoticeVersion?activityNoticeVersionLabel:record.version}</small></p>)}</details>;
}
