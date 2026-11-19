'use client';
import type {Bill,Booking,Cost} from '../lib/domain/types';
import {canManageEvent} from '../lib/domain/permissions';
import {plannedEpoch} from '../lib/time-planning';
import {toast} from 'sonner';
import {Plus,Copy,CheckCircle2,FileClock,Phone,Bell,ChevronRight,UserRound,MoreHorizontal} from 'lucide-react';
import {useState,type ReactNode} from 'react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {settlementFingerprint,settlementView} from '../lib/domain/settlement-state';
import {usesAutomaticAttendance} from '../lib/domain/attendance';
import './fee-confirmation.css';
import './fee-status.css';
import './fee-page.css';
import {hm,dt,epoch,euro,text,timed,halfTimed,number,money,choice,why,modes} from './ui';
type BallCostForm={eventId:string;type:'ball';name:string;pricing:'unit';cents:number;used:number;start:string;end:string;bearer:'members'|'subsidy';advancedBy:string;reason:string};
import {bookingParts} from '../lib/domain/booking-advancers';
import {bookingCents,ballCents,legacyTubeUnitCents} from '../lib/domain/money';
import {collectorRepayment,feeMembers,playerSettled,transferPaid,type Transfer} from '../lib/domain/fee-transfers';
import FeeTransfers,{payRowId,payTransfer} from './fee-transfers';
import {useSectionFocus} from './section-focus';
import type {ClubData} from '../lib/contracts/club';
type FeeRegistration=ClubData['registrations'][number];
/** Court or expense time that nobody present shares, merged per item, for example 2号场 15:00–19:00 €27.60. */
function unshared(detail:{item?:string;name:string;start:number;end:number;unallocated:number}[]){
 const rows:{item?:string;name:string;start:number;end:number;cents:number}[]=[];
 for(const line of detail.filter(l=>l.unallocated>0).sort((a,b)=>(a.item??a.name).localeCompare(b.item??b.name)||a.start-b.start)){
  const last=rows.at(-1);
  if(last&&last.item===line.item&&last.name===line.name&&last.end===line.start){last.end=line.end;last.cents+=line.unallocated}
  else rows.push({item:line.item,name:line.name,start:line.start,end:line.end,cents:line.unallocated});
 }
 return rows;
}
/** An organiser taps a fee item to get its actions in a small dialog, instead of a row of buttons under every item. */
function FeeItem({title,actions,children}:{title:string;actions:{label:string;run:()=>void;danger?:boolean}[];children:ReactNode}){
 const [shown,setShown]=useState(false);
 return <><button type="button" className="fee-item is-editable" aria-haspopup="dialog" aria-label={'调整 '+title} onClick={()=>setShown(true)}>{children}<ChevronRight size={16} aria-hidden="true"/></button>
  <Dialog open={shown} onOpenChange={setShown}><DialogContent className="app-dialog fee-item-sheet" showCloseButton><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>选择要调整的内容。</DialogDescription></DialogHeader>
   <div className="fee-sheet-actions">{actions.map(a=><button key={a.label} type="button" className={a.danger?'ghost danger':'secondary'} onClick={()=>{setShown(false);a.run()}}>{a.label}</button>)}</div>
  </DialogContent></Dialog></>;
}
/** 更多: the organiser's less frequent fee actions (withdraw a version, copy amounts, an ignored update) in one sheet, so
 * the summary shows only the next step. */
function FeeMore({actions}:{actions:{label:string;run:()=>void;danger?:boolean}[]}){
 const [shown,setShown]=useState(false);
 if(!actions.length)return null;
 return <><button type="button" className="ghost fee-more" aria-haspopup="dialog" onClick={()=>setShown(true)}><MoreHorizontal size={16} aria-hidden="true"/>更多</button>
  <Dialog open={shown} onOpenChange={setShown}><DialogContent className="app-dialog fee-item-sheet" showCloseButton><DialogHeader><DialogTitle>更多操作</DialogTitle><DialogDescription>费用分摊的其他操作。</DialogDescription></DialogHeader>
   <div className="fee-sheet-actions">{actions.map(a=><button key={a.label} type="button" className={a.danger?'ghost danger':'secondary'} onClick={()=>{setShown(false);a.run()}}>{a.label}</button>)}</div>
  </DialogContent></Dialog></>;
}
type Payee={id:string;name:string;phone:string;mine:boolean;playerId?:string;leader?:true};
/** 选择收款人 (docs/FEE_PAGE.md): the saved payees in one list, the club owner and administrators first; tapping one makes
 * them this activity's recipient. Whoever saved a payee, and administrators, can remove it. */
function PayeePicker({payees,current,canRemove,busy,close,pick,remove,create}:{payees:Payee[];current?:{phone:string;playerId?:string};canRemove:(p:Payee)=>boolean;busy:boolean;close:()=>void;pick:(p:Payee)=>void;remove:(p:Payee)=>void;create:()=>void}){
 const row=(p:Payee)=>{const on=current?.phone===p.phone&&current?.playerId===p.playerId;return <li key={p.id} className={'fee-payee-option'+(on?' is-current':'')}>
  <button type="button" aria-pressed={on} disabled={busy||on} onClick={()=>pick(p)}><strong>{p.name}</strong><span>{p.phone}</span>{on&&<small>当前</small>}</button>
  {canRemove(p)&&<button type="button" className="ghost fee-payee-remove" aria-label={'删除常用收款人 '+p.name} disabled={busy} onClick={()=>remove(p)}>×</button>}
 </li>};
 const leaders=payees.filter(p=>p.leader),others=payees.filter(p=>!p.leader);
 return <Dialog open onOpenChange={next=>{if(!next)close()}}><DialogContent className="app-dialog fee-payee-picker" showCloseButton>
  <DialogHeader><DialogTitle>选择收款人</DialogTitle><DialogDescription>大家都转给他，再由他转给约场、出球的人。</DialogDescription></DialogHeader>
  {payees.length?<div className="fee-payee-groups" role="group" aria-label="常用收款人">
   {leaders.length>0&&<ul className="fee-payee-options">{leaders.map(row)}</ul>}
   {others.length>0&&<><small className="fee-payee-group-label">其他收款人</small><ul className="fee-payee-options">{others.map(row)}</ul></>}
  </div>:<p className="hint">还没有常用收款人。</p>}
  <div className="actions"><button type="button" className="secondary" disabled={busy} onClick={create}><Plus size={16}/>新的收款人</button></div>
 </DialogContent></Dialog>;
}
export default function Fees({e:ev,ctx}:any){const {data,name,open,setDanger,regs}=ctx;const manager=canManageEvent(data.me,ev);const draft=data.drafts.find((x:any)=>x.eventId===ev.id);const versions=data.settlements.filter((x:any)=>x.eventId===ev.id).sort((a:any,b:any)=>b.version-a.version);const {latest,confirmed,changed,shown}=settlementView(draft,versions,manager);const displayConfirmed=!!latest&&(!manager||confirmed),awaitingEnd=Date.now()<ev.end&&(usesAutomaticAttendance(ev)||data.attendance.some((a:any)=>a.eventId===ev.id&&a.end===null));
// 收款方式 (docs/FEE_PAGE.md): an organiser who chose 统一收款人 sees the payee picker before a recipient is saved.
const [pickRecipient,setPickRecipient]=useState(false);
const [payeePicker,setPayeePicker]=useState(false);
const plannedPreview=manager&&!displayConfirmed&&awaitingEnd&&usesAutomaticAttendance(ev)&&!['ended','cancelled'].includes(ev.status);
// Paid status belongs to the latest confirmed version; a manager's unconfirmed preview shows none.
const payees:{id:string;name:string;phone:string;mine:boolean;playerId?:string;leader?:true}[]=data.settings.feePayees??[];
const statusOn=displayConfirmed&&!(manager&&changed),payments:{eventId:string;playerId:string;cents:number;to?:string}[]=data.payments??[];
const members=feeMembers(data.players),memberName=(id?:string)=>id?name(id):'未填写';
// With fee advances a friend owes through the member who registered them (lib/domain/money.ts).
// A "去付款" link (home, money page, fee reminder) brings the viewer's open transfer, else the summary, into view.
useSectionFocus(ev.id,'pay',statusOn&&latest?.transfers&&payTransfer(latest.transfers,payments,ev.id,data.me.playerId)?payRowId(ev.id):displayConfirmed?'fee-main-'+ev.id:undefined);
const payerOf=(id:string)=>{if(members.some(([m])=>m===id))return id;const owner=data.players.find((p:{id:string;ownerId:string})=>p.id===id)?.ownerId;return data.players.find((p:{id:string;ownerId:string})=>p.ownerId===owner&&members.some(([m])=>m===p.id))?.id??id};
const paid=(b:{playerId:string;total:number})=>latest?.transfers?playerSettled(payments,latest,payerOf(b.playerId)):b.total<=0||payments.filter(p=>p.eventId===ev.id&&p.playerId===b.playerId&&!p.to).reduce((n,p)=>n+p.cents,0)>=b.total;
const proxied=(id:string)=>id!==data.me.playerId&&data.players.find((p:{id:string;ownerId:string})=>p.id===id)?.ownerId===data.me.id;
const canMark=(id:string)=>statusOn&&!!latest?.bills.some((x:{playerId:string})=>x.playerId===id)&&(id===data.me.playerId||proxied(id)||manager);
const markPaid=(id:string,value:boolean)=>void ctx.action('feePaid',{eventId:ev.id,settlementId:latest!.id,playerId:id,paid:value,reason:value?'标记已付款':'撤销付款标记'},false).catch(()=>{});
// The collector owes nothing of their own; what they still owe is the repayments to the advancers.
const repayment=(id:string)=>latest?collectorRepayment(payments,latest,id):null;
const paidStatus=(b:{playerId:string;total:number})=>statusOn&&<div className="fee-paid-status">{repayment(b.playerId)!==null?(repayment(b.playerId)?<span className="fee-status is-unpaid">待还垫付 · {euro(repayment(b.playerId)!)}</span>:<span className="fee-status is-paid">已还清</span>):paid(b)?<span className="fee-status is-paid">已付款</span>:<span className="fee-status is-unpaid">{latest?.transfers?'待转账':'未付款'}</span>}{canMark(b.playerId)&&b.total>0&&!latest?.transfers&&<button type="button" className="ghost" disabled={ctx.busy} onClick={()=>markPaid(b.playerId,!paid(b))}>{paid(b)?'撤销已付款':'标记已付款'}</button>}</div>;
// The reminder targets the latest confirmed version even while a manager previews a newer draft.
const unpaidCount=latest&&latest.confirmed?(latest.transfers?new Set((latest.transfers as Transfer[]).filter(t=>!transferPaid(payments,ev.id,t)).map(t=>t.from)).size:latest.bills.filter((b:{playerId:string;total:number})=>!paid(b)).length):0;
const myFriends=statusOn&&latest?latest.bills.filter((b:{playerId:string})=>proxied(b.playerId)):[];
const exemptLabel=(mode:string)=>mode==='subsidy'?'群补贴':'他人分担';
const exemption=(playerId:string)=>{const r=regs(ev).find((r:FeeRegistration)=>r.playerId===playerId&&r.status==='confirmed');return r?{r,label:[r.courtExempt.mode!=='none'&&'场地'+exemptLabel(r.courtExempt.mode),r.ballExempt.mode!=='none'&&'球费'+exemptLabel(r.ballExempt.mode)].filter(Boolean).join(' · ')}:undefined};
const exempt=(r:FeeRegistration)=>open('设置单项豁免','exemption',{eventId:ev.id,playerId:r.playerId,type:'ball',mode:r.ballExempt.mode,reason:''},[choice('type','费用类别',[['court','场地费'],['ball','球费']]),choice('mode','承担方式',[['none','正常分摊'],['redistribute','豁免，由其他道友分担'],['subsidy','豁免，由群补贴承担']]),why]);
// Everyone's amount on one line; organisers set an exemption from the same row.
const bill=(b:Bill)=>{const x=exemption(b.playerId);return <div className="bill-row" key={b.playerId}><div><strong>{name(b.playerId)}{proxied(b.playerId)&&<small className="fee-proxy-tag">代报名</small>}{x?.label&&<small className="fee-proxy-tag is-exempt">{x.label}</small>}</strong><small>{Math.round(b.minutes)} 分钟{[['场地',b.court],['球',b.ball],['其他',b.other]].filter(([,c])=>Number(c)>0).map(([k,c])=>' · '+k+' '+euro(Number(c))).join('')}</small></div><strong>{euro(b.total)}</strong>{manager&&x&&<button type="button" className="ghost fee-exempt-button" aria-label={'设置 '+name(b.playerId)+' 的费用豁免'} onClick={()=>exempt(x.r)}>豁免</button>}{paidStatus(b)}</div>};
// Three cards, nothing folded (docs/FEE_PAGE.md): the summary (state, my amount, organiser actions, transfers, payee),
// everyone's amount, and the ledger of court, shuttle and other costs.
const mine=shown?.bills.find((b:Bill)=>b.playerId===data.me.playerId);
const state=displayConfirmed?'已确认 · 第 '+latest!.version+' 版':plannedPreview?'预估':changed?'有更新 · 待重新确认':'未确认';
const note=displayConfirmed?(draft?.ignoredUpdate?'已忽略一次费用变化，仍按这一版付款。':manager&&changed?'有新的变化，重新确认后球友才看到新金额。':''):plannedPreview?'按接龙时段预估，活动结束后确认。':changed?'球友目前看到第 '+latest!.version+' 版。':awaitingEnd?'活动结束后可以确认。':'';
const courtTotal=data.bookings.filter((b:Booking)=>b.eventId===ev.id).reduce((n:number,b:Booking)=>n+bookingCents(b),0),ballTotal=data.costs.filter((c:Cost)=>c.eventId===ev.id&&c.type==='ball').reduce((n:number,c:Cost)=>n+ballCents(c),0);
const modeName=(mode:string)=>modes.find(([k])=>k===mode)?.[1];
return <>
<section className={'card fee-main-summary '+(displayConfirmed?'is-confirmed':'is-pending')} id={'fee-main-'+ev.id} role="status" aria-live="polite">
 <header className="fee-hero-head"><span className={'fee-state '+(displayConfirmed?'is-confirmed':'is-pending')}>{displayConfirmed?<CheckCircle2 size={15} aria-hidden="true"/>:<FileClock size={15} aria-hidden="true"/>}{state}</span><span className="fee-total">{shown?.bills.length??0} 人 · 合计 {euro(shown?.total??0)}</span></header>
 {/* With transfers, each one's status is on its own row below; the amounts here do not repeat it. */}
 {mine?<div className="fee-my-amount fee-mine"><span>我的分摊</span><strong>{euro(mine.total)}</strong>{!latest?.transfers&&paidStatus(mine)}</div>:!shown?.bills.length&&<p className="empty">还没有可分摊的费用</p>}
 {myFriends.length>0&&<div className="fee-my-friends">{myFriends.map((b:{playerId:string;total:number})=><div className="fee-my-amount" key={b.playerId}><span>{name(b.playerId)}<small>代报名</small></span><strong>{euro(b.total)}</strong>{!latest?.transfers&&paidStatus(b)}</div>)}</div>}
 {note&&<p className="fee-note">{note}</p>}
 {manager&&(shown?.unallocated??0)>0&&<p className="warning fee-unshared"><strong>{euro(shown?.unallocated??0)} 没人分摊</strong>：{unshared(shown!.detail).map(r=>r.name+' '+hm(r.start)+'–'+hm(r.end)).join('、')}。缩短场地时间或改为群补贴后才能确认。</p>}
 {manager&&(()=>{
  // One next step in view: confirm while there is something to confirm, otherwise remind the unpaid. The rest is in 更多.
  const copyAmounts=async()=>{if(!latest)return;try{await navigator.clipboard.writeText(`${data.settings.name} · ${ev.title} · 费用分摊 第${latest.version}版\n总费用 ${euro(latest.total)}，群补贴 ${euro(latest.subsidy)}\n${latest.bills.map((b:Bill)=>`${name(b.playerId)}：${euro(b.total)}`).join('\n')}`);toast.success('已复制分摊金额')}catch{toast.error('复制失败')}};
  const more=[
   ...(latest&&changed?[{label:'忽略这次更新',run:()=>{if(draft)void ctx.action('feeUpdateIgnore',{eventId:ev.id,settlementId:latest.id,fingerprint:settlementFingerprint(draft),reason:'忽略这次费用更新'},false).catch(()=>{})}}]:[]),
   ...(latest&&draft?.ignoredUpdate?[{label:'查看被忽略的更新',run:()=>void ctx.action('feeUpdateIgnore',{eventId:ev.id,settlementId:latest.id,fingerprint:null,reason:'恢复费用更新提示'},false).catch(()=>{})}]:[]),
   ...(latest?[{label:'复制分摊金额',run:()=>void copyAmounts()},{label:'撤回第 '+latest.version+' 版',danger:true,run:()=>setDanger({action:'settleRevoke',payload:{eventId:ev.id,settlementId:latest.id},title:'撤回第 '+latest.version+' 版分摊',description:(versions.some((v:{confirmed:boolean;version:number})=>v.confirmed&&v.version<latest.version)?'撤回后，上一个确认的版本重新生效，球友按它付款。':'撤回后，本活动回到“分摊尚未确认”。')+'第 '+latest.version+' 版保留在记录里，已标记的付款不变。',reason:''})}]:[]),
  ];
  return <div className="actions fee-manage-actions">
   {!confirmed&&<button className="secondary" disabled={ctx.busy||!draft} onClick={()=>open('保存分摊草稿','settle',{eventId:ev.id,confirmed:false,reason:'保存费用分摊草稿'},[why])}>保存草稿</button>}
   {!confirmed&&<button className="primary" disabled={ctx.busy||!draft||shown!.unallocated>0||awaitingEnd} onClick={()=>open('确认分摊结果','settle',{eventId:ev.id,confirmed:true,reason:'确认活动费用分摊'},[why],undefined,'核对费用、豁免及群补贴，保存每人的分摊金额。')}>{changed?'确认新的分摊':'确认分摊'}</button>}
   {latest&&confirmed&&(unpaidCount?<button className="secondary" disabled={ctx.busy} title="再提醒一次还没标记付款的球友（6 小时内最多一次）" onClick={()=>void ctx.action('notifyFees',{eventId:ev.id,settlementId:latest.id,reason:'提醒未付款的球友'},false).catch(()=>{})}><Bell size={16}/> 提醒未付款（{unpaidCount} 人）</button>:<span className="fee-all-paid"><CheckCircle2 size={16} aria-hidden="true"/>全部已付款</span>)}
   <FeeMore actions={more}/>
  </div>;
 })()}
 {statusOn&&latest?.transfers&&<FeeTransfers e={ev} settlement={latest} ctx={ctx} manager={manager}/>}
 {(manager||ev.feeRecipient&&!(statusOn&&latest?.transfers))&&<section className="fee-recipient">
  {manager&&<div className="fee-collect-mode" role="radiogroup" aria-label="收款方式">{([[false,'无统一收款人'],[true,'统一收款人']] as const).map(([on,label])=>{const current=on===(!!ev.feeRecipient||pickRecipient);return <button type="button" role="radio" key={label} aria-checked={current} className={'fee-collect-option'+(current?' is-current':'')} disabled={ctx.busy} onClick={()=>{if(current)return;setPickRecipient(on);if(!on&&ev.feeRecipient)void ctx.action('feeRecipient',{eventId:ev.id,none:true,reason:'不用统一收款人'},false).catch(()=>{})}}>{label}</button>})}</div>}
  {ev.feeRecipient?<div className="fee-recipient-card"><div className="fee-recipient-who"><small>收款人</small><strong>{ev.feeRecipient.name}</strong>{manager&&<button type="button" className="ghost fee-recipient-change" disabled={ctx.busy} onClick={()=>setPayeePicker(true)}>更换</button>}</div>{!(statusOn&&latest?.transfers)&&<div className="fee-recipient-phone"><a className="secondary" href={'tel:'+ev.feeRecipient.phone.replace(/[^+\d]/g,'')}><Phone size={16}/>{ev.feeRecipient.phone}</a><button className="ghost" aria-label="复制电话号码" title="复制电话号码" onClick={async()=>{try{await navigator.clipboard.writeText(ev.feeRecipient.phone);toast.success('电话号码已复制')}catch{toast.error('复制失败，请手动复制号码')}}}><Copy size={16}/>复制</button></div>}</div>
  :manager&&pickRecipient?<button type="button" className="fee-recipient-pick" disabled={ctx.busy} onClick={()=>setPayeePicker(true)}><UserRound size={18} aria-hidden="true"/>选择收款人</button>
  :<p className="hint">大家直接转给约场、出球的人{latest?.transfers?'，按上面的转账结算付款':''}。</p>}
  {manager&&payeePicker&&<PayeePicker payees={payees.filter(p=>p.playerId&&members.some(([id])=>id===p.playerId))} current={ev.feeRecipient} canRemove={p=>p.mine||data.me.role==='admin'} busy={ctx.busy} close={()=>setPayeePicker(false)}
   pick={p=>{setPayeePicker(false);void ctx.action('feeRecipient',{eventId:ev.id,playerId:p.playerId,phone:p.phone,reason:'使用常用收款人'},false).catch(()=>{})}}
   remove={p=>void ctx.action('feePayeeRemove',{payeeId:p.id,reason:'删除常用收款人'},false).catch(()=>{})}
   create={()=>{setPayeePicker(false);open('新的收款人','feeRecipient',{eventId:ev.id,playerId:ev.feeRecipient?.playerId??'',phone:ev.feeRecipient?.phone??'',reason:'设置活动收款信息'},[choice('playerId','收款人（群里的球友）',members),{key:'phone',label:'电话号码（可带区号）',type:'tel'},why],undefined,'大家转给收款人，再由他转给约场和出球的人。保存后存为常用收款人。')}}/>}
 </section>}
</section>
{shown&&shown.bills.length>0&&<section className="card fee-section fee-people" aria-label="每人分摊"><header className="fee-section-head"><h3>每人分摊</h3><span>{shown.bills.length} 人</span></header>{shown.bills.map(bill)}</section>}
<section className="card fee-section fee-ledger" aria-label="账目">
 <header className="fee-section-head"><h3>账目</h3><span>{[['场地',courtTotal],['球',ballTotal],['群补贴',shown?.subsidy??0],['待分配',shown?.unallocated??0]].filter(([k,c])=>k==='场地'||Number(c)>0).map(([k,c])=>k+' '+euro(Number(c))).join(' · ')}</span></header>
 {data.bookings.filter((b:Booking)=>b.eventId===ev.id).map((b:Booking)=>{
  const body=<><span className="fee-item-main"><strong>{b.name} · {hm(b.start)}–{hm(b.end)}</strong><small>约场 {bookingParts(b).map(p=>(p.advancedBy?name(p.advancedBy):'待认领')+(b.handovers?.length?' '+hm(p.start)+'–'+hm(p.end):'')).join(' · ')}{b.bearer==='subsidy'?' · 群补贴承担':''}</small></span><span className="fee-item-amount">{euro(bookingCents(b))}</span></>;
  return manager?<FeeItem key={b.id} title={b.name+' · '+hm(b.start)+'–'+hm(b.end)} actions={[...bookingParts(b).map(p=>({label:b.handovers?.length?'约场人 '+hm(p.start)+' 起':'约场人',run:()=>open('谁约的这个场地时段','feeAdvance',{eventId:ev.id,itemId:b.id,advancedBy:p.advancedBy??'',...(b.handovers?.length?{at:p.start}:{}),reason:''},[choice('advancedBy',b.handovers?.length?'约 '+hm(p.start)+'–'+hm(p.end)+' 的球友（这段场费由他垫付）':'约场的球友（场费由他垫付）',members),why])})),{label:'由谁承担',run:()=>open('指定场地费用承担','bookingBearer',{bookingId:b.id,bearer:b.bearer??'members',reason:''},[choice('bearer','承担',[['members','道友分摊'],['subsidy','群补贴承担']]),why])},{label:'修正预约',run:()=>open('修正场地费用与时段','bookingEdit',{bookingId:b.id,name:b.name,start:dt(b.start),end:dt(b.end),pricing:b.pricing,cents:b.cents,reason:''},[text('name','场地名称'),halfTimed('start','预约开始'),halfTimed('end','预约结束'),choice('pricing','计价方式',[['hourly','每小时'],['total','时段总价']]),money('cents','金额 · 欧元'),why],(v:Record<string,unknown>)=>({...v,start:plannedEpoch(String(v.start),b.start),end:plannedEpoch(String(v.end),b.end)}))}]}>{body}</FeeItem>:<div className="fee-item" key={b.id}>{body}</div>;
 })}
 {data.costs.filter((c:Cost)=>c.eventId===ev.id).map((c:Cost)=>{
  const body=<><span className="fee-item-main"><strong>{c.name||(c.type==='ball'?'用球':'其他费用')}</strong><small>{c.type==='ball'?`${c.used} 颗 · ${c.pricing==='tube'?(legacyTubeUnitCents(c)!==null?euro(legacyTubeUnitCents(c)!)+' / 颗（旧记录 '+euro(c.cents)+' / '+c.tubeCount+'颗）':'旧记录按筒计价 '+euro(c.cents)+' / '+c.tubeCount+'颗'):euro(c.cents)+' / 颗'}`:'其他费用'} · {c.type==='ball'?'球主':'垫付'} {memberName(c.advancedBy)}{c.bearer==='subsidy'?' · 群补贴承担':''}</small></span><span className="fee-item-amount">{euro(c.type==='ball'?ballCents(c):c.cents)}</span></>;
  return manager?<FeeItem key={c.id} title={c.name||(c.type==='ball'?'用球':'其他费用')} actions={[{label:c.type==='ball'?'球主':'垫付人',run:()=>open(c.type==='ball'?'这些球是谁的':'谁付的这笔费用','feeAdvance',{eventId:ev.id,itemId:c.id,advancedBy:c.advancedBy??'',reason:''},[choice('advancedBy',c.type==='ball'?'球主（球费由他垫付）':'付钱的球友',members),why])},...(c.type==='ball'?[{label:'时段调整',run:()=>open('修正球费时段','costOverride',{costId:c.id,start1:dt(ev.start),end1:dt(ev.start+Math.floor((ev.end-ev.start)/2)),amount1:Math.floor(ballCents(c)/2),start2:dt(ev.start+Math.floor((ev.end-ev.start)/2)),end2:dt(ev.end),amount2:ballCents(c)-Math.floor(ballCents(c)/2),reason:''},[timed('start1','第一段开始'),timed('end1','第一段结束'),money('amount1','第一段球费 · 欧元'),timed('start2','第二段开始'),timed('end2','第二段结束'),money('amount2','第二段球费 · 欧元'),why],(v:{costId:string;reason:string;start1:string;end1:string;amount1:number;start2:string;end2:string;amount2:number})=>({costId:v.costId,reason:v.reason,segments:[{start:epoch(v.start1),end:epoch(v.end1),cents:v.amount1},{start:epoch(v.start2),end:epoch(v.end2),cents:v.amount2}]}),'两段合计必须等于项目总球费，支持金额为0；更多时段可添加独立耗球记录。')}]:[]),{label:'移除',danger:true,run:()=>setDanger({action:'deleteCost',payload:{costId:c.id},title:'移除费用项目',description:'下次确认后更新每人分摊金额。',reason:''})}]}>{body}</FeeItem>:<div className="fee-item" key={c.id}>{body}</div>;
 })}
 <div className="fee-rules"><span>分摊方式：场地{modeName(ev.courtMode)} · 球费{modeName(ev.ballMode)}</span>{manager&&<button className="ghost" onClick={()=>open('修改分摊模式','modes',{eventId:ev.id,courtMode:ev.courtMode,ballMode:ev.ballMode,reason:''},[choice('courtMode','场地费',modes),choice('ballMode','球费',modes),why])}>修改</button>}</div>
 {manager&&<div className="actions fee-add"><button className="secondary" onClick={()=>open('记录实际耗球','cost',{eventId:ev.id,type:'ball',name:'',pricing:'unit',cents:ev.practiceShuttleCents??200,used:0,start:'',end:'',bearer:'members',advancedBy:'',reason:'实际耗球记录'},[text('name','型号'),money('cents','单颗价格 · 欧元/颗'),{...number('used','消耗颗数'),min:0},timed('start','消耗开始（可选）',true),timed('end','消耗结束（可选）',true),choice('bearer','承担',[['members','道友分摊'],['subsidy','群补贴']]),choice('advancedBy','这些球是谁的（球费由他垫付）',members),why],(v:BallCostForm)=>({...v,pricing:'unit',start:v.start?epoch(v.start):null,end:v.end?epoch(v.end):null}),'球费 = 单颗价格 × 消耗颗数，精确到分。整筒请换算成颗数填写，如1筒12颗另加4颗填16。')}><Plus size={16}/> 记录耗球</button><button className="ghost" onClick={()=>open('其他费用','cost',{eventId:ev.id,type:'other',name:'',pricing:'total',cents:0,used:0,start:null,end:null,bearer:'members',advancedBy:'',reason:''},[text('name','项目名称'),money('cents','金额 · 欧元'),choice('bearer','承担',[['members','道友等额分摊'],['subsidy','群补贴']]),choice('advancedBy','谁付的钱（由他垫付）',members),why])}><Plus size={16}/> 其他费用</button></div>}
</section>


</>}



