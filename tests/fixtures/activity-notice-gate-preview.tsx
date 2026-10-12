import {useEffect,useState} from 'react';
import ActivityNoticeGate,{AccountNoticeEvidence} from '../../app/activity-notice-gate';
import {activityNoticeVersion,activityNoticeSnapshot} from '../../lib/activity-notice';

/** Synthetic local-only preview: never calls the production API or changes an account. */
export default function NoticeGatePreview(){
 const [confirmed,setConfirmed]=useState(false),[loggedOut,setLoggedOut]=useState(false),[simulateFailure,setSimulateFailure]=useState(true);
 const [hash,setHash]=useState('');
 useEffect(()=>{void crypto.subtle.digest('SHA-256',new TextEncoder().encode(activityNoticeSnapshot())).then(digest=>setHash(Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('')))},[]);
 const accept=async()=>{if(simulateFailure){setSimulateFailure(false);throw Error('本地演示：第一次保存失败，请重试。')}setConfirmed(true)};
 return <main className="shell"><h1>活动须知 · 本地预览</h1>{!hash?<p>正在准备本地预览…</p>:loggedOut?<p>已退出虚构账号</p>:confirmed?<><p role="status">本地模拟确认完成</p><AccountNoticeEvidence receipts={[{id:'preview-receipt',accountId:'preview-account',playerId:'preview-player',version:activityNoticeVersion,contentHash:hash,contentSnapshot:'本地虚构确认记录，未保存线上证据。',acceptedAt:1791810000000,method:'explicit-account-confirmation'}]}/></>:<ActivityNoticeGate accountId="preview-account" notice={{currentVersion:activityNoticeVersion,contentHash:hash}} onAccept={accept} onLogout={()=>setLoggedOut(true)}/>}</main>;
}
