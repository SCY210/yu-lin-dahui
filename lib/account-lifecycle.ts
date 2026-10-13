import {env} from 'cloudflare:workers';
import {raw, load, save, committed} from './store';
import {assertCanDeleteAccount, deletionGraceMs, eraseAccount, relinquishAdmin} from './domain/account-lifecycle';
import {fail} from './domain/types';
import type {AppUser} from './auth';
import {checkPassword} from './password';
import {RequestError} from './request-body';

const conflict = (error: unknown) => String(error).includes('UNIQUE constraint failed: commits');
export async function deletionRequest(accountId: string) {
  return raw().prepare('SELECT requested_at AS requestedAt,delete_after AS deleteAfter FROM account_deletions WHERE account_id=?').bind(accountId).first<{requestedAt: number; deleteAfter: number}>();
}
export async function blockedLegacyIdentity(accountId: string) {
  return !!await raw().prepare('SELECT id FROM erased_identities WHERE id=?').bind(await identityHash(accountId)).first();
}
async function identityHash(id: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('erased-identity:' + id)))).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function ownAccountAction(user: AppUser, action: 'requestDeletion'|'relinquishAdmin', requestId: string, currentPassword?: string, sessionId?: string) {
  const key = user.userId + ':' + action + ':' + requestId;
  for (let attempt = 0; attempt < 5; attempt++) {
    const s = await load(), a = s.accounts.find(a => a.id === user.userId);
    if (!a) fail('403: 账号不可用');
    const pending = await deletionRequest(a.id);
    if (pending) throw new RequestError('账号正在等待注销，请重新登录取消注销', 401);
    if (await committed(key)) return {ok: true, duplicate: true};
    const credential = await raw().prepare('SELECT salt,hash FROM password_credentials WHERE id=?').bind(a.id).first<{salt: string;hash: string}>();
    if (user.method === 'password' && (!credential || !currentPassword || !checkPassword(currentPassword, credential.salt, credential.hash))) throw new RequestError('当前密码不正确', 401);
    const previous = structuredClone(s), now = Date.now(), extra: D1PreparedStatement[] = [];
    if (action === 'requestDeletion') {
      assertCanDeleteAccount(s, a);
      extra.push(raw().prepare('INSERT INTO account_deletions(account_id,requested_at,delete_after) VALUES(?,?,?)').bind(a.id, now, now + deletionGraceMs));
      extra.push(raw().prepare('DELETE FROM auth_sessions WHERE user_id=?').bind(a.id));
      // Prevent notifications during the waiting period.
      extra.push(raw().prepare('DELETE FROM push_subscriptions WHERE account_id=?').bind(a.id));
    } else relinquishAdmin(s, a);
    s.audits.push({id: crypto.randomUUID(), at: now, actor: a.id, action, reason: action === 'requestDeletion' ? '本人申请注销，30天内重新登录取消' : '本人放弃管理员权限'});
    const guards: D1PreparedStatement[] = [];
    if (user.method === 'password' && credential) {
      // The revision gate alone cannot detect concurrent credential changes.
      guards.push(raw().prepare('INSERT INTO commits(revision,key,at) SELECT ?,?,? WHERE NOT EXISTS(SELECT 1 FROM password_credentials WHERE id=? AND salt=? AND hash=?) OR NOT EXISTS(SELECT 1 FROM auth_sessions WHERE id=? AND user_id=? AND expires>?)').bind(s.revision + 1, key, now, a.id, credential.salt, credential.hash, sessionId ?? '', a.id, now));
    }
    try {await save(s, key, previous, extra, guards); return {ok: true, deleteAfter: action === 'requestDeletion' ? now + deletionGraceMs : undefined};}
    catch (error) {if (conflict(error) && attempt < 4) continue; throw error;}
  }
  fail('409: 账号正在更新，请稍后重试');
}

/** Called only after verified, deliberate sign-in, never by background reads. */
export async function cancelAccountDeletion(accountId: string, loginStatements: D1PreparedStatement[] = []) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const s = await load(), pending = await deletionRequest(accountId), now = Date.now();
    if (!s.accounts.some(a => a.id === accountId)) throw new RequestError('账号不可用', 401);
    if (!pending) return false;
    if (pending.deleteAfter <= now) throw new RequestError('注销期限已到，账号不能恢复', 401);
    const previous = structuredClone(s), key = 'cancel-deletion:' + crypto.randomUUID();
    s.audits.push({id: crypto.randomUUID(), at: now, actor: accountId, action: 'cancelAccountDeletion', reason: '30天内重新登录，取消本人注销'});
    const extra = [...loginStatements];
    if (loginStatements.length) extra.push(raw().prepare('INSERT INTO commits(revision,key,at) SELECT ?,?,? WHERE changes()=0').bind(s.revision + 1, key, now));
    extra.push(raw().prepare('DELETE FROM account_deletions WHERE account_id=? AND delete_after>?').bind(accountId, now));
    extra.push(raw().prepare('INSERT INTO commits(revision,key,at) SELECT ?,?,? WHERE changes()=0').bind(s.revision + 1, key, now));
    try {await save(s, key, previous, extra); return true;}
    catch (error) {if (conflict(error) && attempt < 4) continue; throw error;}
  }
  fail('409: 注销状态正在更新，请稍后重新登录');
}

/** D1 removal and R2 cleanup are retryable; R2 failures retain a durable job. */
export async function purgeExpiredAccounts(now = Date.now()) {
  const due = (await raw().prepare('SELECT account_id FROM account_deletions WHERE delete_after<=? ORDER BY delete_after LIMIT 20').bind(now).all<{account_id: string}>()).results;
  for (const {account_id: id} of due) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const s = await load(), pending = await deletionRequest(id);
      if (!pending || pending.deleteAfter > now) break;
      const previous = structuredClone(s), keys = eraseAccount(s, id, now);
      const before = [
        raw().prepare('DELETE FROM auth_sessions WHERE user_id=?').bind(id),
        raw().prepare('DELETE FROM password_credentials WHERE id=?').bind(id),
        raw().prepare('DELETE FROM account_deletions WHERE account_id=?').bind(id),
        raw().prepare('DELETE FROM trial_credential_archive WHERE id=? OR instr(payload,?)>0').bind(id, id),
        raw().prepare("UPDATE commits SET key='erased:'||revision WHERE instr(key,?)>0").bind(id),
      ];
      // Foreign-key references in retained sporting records must be repointed
      // before the original player is removed by save().
      const newPlayer = s.players.find(p => !previous.players.some(old => old.id === p.id));
      if (newPlayer) {
        before.push(raw().prepare('INSERT INTO players(id,owner_id,payload) VALUES(?,?,?)').bind(newPlayer.id, '', JSON.stringify(newPlayer)));
        for (const table of ['registrations','attendance','payments']) before.push(raw().prepare(`UPDATE ${table} SET player_id=? WHERE player_id=?`).bind(newPlayer.id, previous.accounts.find(a => a.id === id)!.playerId));
      }
      const extra = [raw().prepare('INSERT OR IGNORE INTO erased_identities(id) VALUES(?)').bind(await identityHash(id)),
        ...keys.map(key => raw().prepare('INSERT OR IGNORE INTO account_erasure_objects(storage_key) VALUES(?)').bind(key))];
      try {await save(s, 'erase-account:' + crypto.randomUUID(), previous, extra, before); break;}
      catch (error) {if (conflict(error) && attempt < 4) continue; throw error;}
    }
  }
  const jobs = (await raw().prepare('SELECT storage_key FROM account_erasure_objects LIMIT 50').all<{storage_key: string}>()).results;
  for (const {storage_key: key} of jobs) {
    if (!env.BUCKET) throw new Error('Image storage unavailable for account erasure');
    await env.BUCKET.delete(key);
    await raw().prepare('DELETE FROM account_erasure_objects WHERE storage_key=?').bind(key).run();
  }
}
