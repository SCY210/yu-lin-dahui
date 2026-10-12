'use client';
import {useEffect,useRef,useState} from 'react';
import {FileCheck2,LogOut,ShieldCheck,Download} from 'lucide-react';
import {Checkbox} from '@/components/ui/checkbox';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {activityNoticeTitle,activityNoticeVersion,activityNoticeSnapshot,accountNoticeScope,accountNoticeCheckbox} from '../lib/activity-notice';
import {ActivityNoticeDetails} from './activity-notice';
import {fmt} from './form-fields';
import './activity-notice-gate.css';

export type AccountNoticeReceiptView={id:string;accountId:string;playerId:string;version:string;contentHash:string;contentSnapshot:string;acceptedAt:number;method:'explicit-account-confirmation'};
type GateProps={accountId:string;notice:{currentVersion:string;contentHash:string};busy?:boolean;onAccept:()=>Promise<unknown>;onLogout:()=>void};

/** Only the server-confirmed parent projection can remove this gate. */
export default function ActivityNoticeGate(props:GateProps){
 return <AccountNoticeGateForm key={props.accountId+':'+props.notice.currentVersion+':'+props.notice.contentHash} {...props}/>;
}
function AccountNoticeGateForm({notice,busy=false,onAccept,onLogout}:GateProps){
 const [checked,setChecked]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState('');
 const [verification,setVerification]=useState<'checking'|'verified'|'mismatch'>('checking');
 const inFlight=useRef(false);
 const versionMismatch=notice.currentVersion!==activityNoticeVersion;
 useEffect(()=>{
  if(versionMismatch)return;
  let active=true;
  void (async()=>{
   try{
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(activityNoticeSnapshot()));
    const hash=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
    if(active)setVerification(hash===notice.contentHash?'verified':'mismatch');
   }catch{if(active)setVerification('mismatch')}
  })();
  return()=>{active=false};
 },[notice.contentHash,versionMismatch]);
 const verified=!versionMismatch&&verification==='verified';
 const stale=versionMismatch||verification==='mismatch';
 const disabled=busy||saving;
 async function accept(){
  if(!checked||!verified||disabled||inFlight.current)return;
  inFlight.current=true;setSaving(true);setError('');
  try{await onAccept()}
  catch(cause){setError(cause instanceof Error?cause.message:'确认未保存，请检查网络后重试。')}
  finally{inFlight.current=false;setSaving(false)}
 }
 return <Dialog open historyCloseBlocked onOpenChange={()=>{}}><DialogContent className="app-dialog account-notice-gate" showCloseButton={false} onEscapeKeyDown={event=>event.preventDefault()} onInteractOutside={event=>event.preventDefault()}>
  <DialogHeader><span className="account-notice-symbol"><ShieldCheck size={26} aria-hidden="true"/></span><DialogTitle>{activityNoticeTitle}</DialogTitle><DialogDescription>{accountNoticeScope}</DialogDescription></DialogHeader>
  <div className="account-notice-scroll" tabIndex={0} aria-label="活动参与须知全文">{stale?<p className="account-notice-error" role="alert">须知版本或内容已更新，当前页面无法核对。请重新加载后阅读并确认。</p>:<ActivityNoticeDetails defaultOpen/>}<p className="account-notice-storage"><FileCheck2 size={17} aria-hidden="true"/><span>确认仅在服务器保存成功后生效，你可以在「我的」查看和下载确认记录。</span></p></div>
  <div className="account-notice-footer"><label className="account-notice-checkbox"><Checkbox checked={checked} disabled={disabled||!verified} onCheckedChange={value=>{if(verified&&!disabled)setChecked(value===true)}} aria-label={accountNoticeCheckbox}/><span>{accountNoticeCheckbox}</span></label>
   {error&&<p className="account-notice-error" role="alert">{error}</p>}
   <div className="account-notice-actions">{stale?<button type="button" className="primary" disabled={disabled} onClick={()=>window.location.reload()}>重新加载须知</button>:<button type="button" className="primary" disabled={!checked||!verified||disabled} onClick={()=>void accept()}>{saving?'正在保存确认…':verification==='checking'?'正在核对须知…':'同意并继续'}</button>}<button type="button" className="ghost" disabled={disabled} onClick={onLogout}><LogOut size={16} aria-hidden="true"/>退出登录</button></div>
   <p className="account-notice-version">版本 {notice.currentVersion} · 确认保存成功后才能继续</p>
  </div>
 </DialogContent></Dialog>;
}

export function AccountNoticeEvidence({receipts,allAccounts=false}:{receipts:AccountNoticeReceiptView[];allAccounts?:boolean}){
 return <details className="account-notice-evidence"><summary><FileCheck2 size={17} aria-hidden="true"/>我的须知确认记录</summary><div className="account-notice-evidence-body"><p>以下时间和记录来自服务器；旧接龙记录不替代本账号确认。</p>{receipts.length?receipts.slice().reverse().map(receipt=><section key={receipt.id}><strong>{fmt(receipt.acceptedAt,{year:'numeric',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'})}</strong><dl><dt>确认账号</dt><dd>{receipt.accountId}</dd><dt>须知版本</dt><dd>{receipt.version}</dd><dt>内容摘要</dt><dd><code>{receipt.contentHash}</code></dd><dt>记录编号</dt><dd>{receipt.id}</dd></dl><details><summary>查看当时确认的全文</summary><pre>{receipt.contentSnapshot}</pre></details></section>):<p>暂无本账号确认记录。</p>}<div className="account-notice-downloads"><a className="secondary" href="/api/club?noticeExport=1" download><Download size={15} aria-hidden="true"/>下载我的确认记录</a>{allAccounts&&<a className="secondary" href="/api/club?noticeExport=all" download><Download size={15} aria-hidden="true"/>下载全体确认记录</a>}</div><p>记录用于核对，不能单独证明本人身份或保证法律免责。</p></div></details>;
}
