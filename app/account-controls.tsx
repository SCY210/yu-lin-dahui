'use client';
import {useState} from 'react';
import type {AccountControlsProps} from '../lib/client/account-controls-context';
import {toast} from 'sonner';
import {Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription} from '@/components/ui/dialog';
import {notifySessionChange} from '../lib/client/session-sync';
import {readActionResponse} from '../lib/client/api-response';

export default function AccountControls({isOwner, role, method, refresh}: AccountControlsProps) {
  const [action, setAction] = useState<'requestDeletion'|'relinquishAdmin'|null>(null);
  const [password, setPassword] = useState(''), [confirmed, setConfirmed] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const deleting = action === 'requestDeletion';
  function close() {if (!busy) {setAction(null); setPassword(''); setConfirmed(false); setError('');}}
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (busy || !action || !confirmed) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/auth', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action, requestId: crypto.randomUUID(), confirmed: true, ...(method === 'password' ? {currentPassword: password} : {})})});
      const result = await readActionResponse(response);
      if (deleting) {
        try {if (result.deleteAfter) sessionStorage.setItem('account-deletion-notice', new Date(result.deleteAfter).toISOString());} catch { /* The server deadline remains authoritative when browser storage is disabled. */ }
        notifySessionChange(); location.replace('/'); return;
      }
      setAction(null); setPassword(''); setConfirmed(false);
      toast.success('已放弃管理员权限，现在是普通成员'); await refresh();
    } catch (error) {setError(error instanceof Error ? error.message : '操作未完成，请重试');}
    finally {setBusy(false);}
  }
  return <section className="card"><h3>账号与权限</h3>
    <p className="muted">申请注销后立即退出全部设备。30天内重新登录会自动取消注销；30天届满后不能恢复，系统会自动清理账号。</p>
    <p className="hint">清理登录账号、密码、个人档案、须知确认、羽币与兑换记录和与你关联的站内照片，取消未来报名。历史比赛与费用以“已注销球友”保留。其他人的文字、已导出的副本及备份需联系运营者处理。<a href="/privacy">查看隐私说明</a></p>
    {isOwner ? <p className="hint">群主账号有固定最高权限。注销或放弃权限前需要先安排群组所有权交接。</p> : <div className="actions">
      {role === 'admin' && <button className="secondary" onClick={() => setAction('relinquishAdmin')}>放弃管理员权限</button>}
      <button className="secondary" onClick={() => setAction('requestDeletion')}>注销我的账号</button>
    </div>}
    <Dialog open={!!action} historyCloseBlocked={busy} onOpenChange={open => {if (!open) close();}}><DialogContent className="app-dialog" showCloseButton={!busy} onEscapeKeyDown={e => {if (busy) e.preventDefault();}} onInteractOutside={e => {if (busy) e.preventDefault();}}>
      <DialogHeader><DialogTitle>{deleting ? '申请注销我的账号' : '放弃管理员权限'}</DialogTitle><DialogDescription>{deleting ? '提交后退出全部设备，30天内重新登录即可取消。期限届满后无法恢复。' : '立即变为普通成员，无需群主审批。账号和比赛记录保留；以后需要群主重新授予管理员权限。'}</DialogDescription></DialogHeader>
      <form onSubmit={submit}><div className="form-fields">
        {deleting && <p>登录凭据和个人资料将被清理，历史比赛和费用改为“已注销球友”。站内关联照片会被移除，导出副本和备份不在自动清理范围内。</p>}
        {method === 'password' && <label>当前密码<input type="password" required maxLength={128} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} disabled={busy}/></label>}
        <label><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} disabled={busy}/> {deleting ? '我已了解30天期限、重新登录取消注销及清理范围' : '我确认自愿放弃管理员权限'}</label>
      </div>{error && <p className="error" role="alert">{error}</p>}<div className="actions"><button type="button" className="secondary" disabled={busy} onClick={close}>取消</button><button className="primary" disabled={busy || !confirmed}>{busy ? '正在处理…' : deleting ? '确认申请注销' : '确认放弃权限'}</button></div></form>
    </DialogContent></Dialog>
  </section>;
}
