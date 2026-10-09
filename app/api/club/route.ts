import { privateEventState } from '../../../lib/domain/event-privacy';
import { assertWriteRequest, releaseRejectedWriteBody, writeErrorResponse } from '../../../lib/write-security';
import { cleanExpiredRateLimits, consumeRateLimit, reserveDailyCreation, trustedClientIP } from '../../../lib/rate-limit';
import { isClubOwner } from '../../../lib/domain/ownership';
import { canChangeOwnUsername } from '../../../lib/username-policy';
import { readJsonBody } from '../../../lib/request-body';
import type { ClubData } from '../../../lib/contracts/club';
import { loadClubState } from '../../../lib/club-maintenance';
import { projectClubState } from '../../../lib/club-view';
import { getAppUser } from '../../../lib/auth';
import { save, committed, raw, clubReadVersion } from '../../../lib/store';
import { createClubReadCache, clubViewValidUntil } from '../../../lib/club-read-cache';
import { apply, digest } from '../../../lib/domain/commands';
import { month, fail } from '../../../lib/domain/types';
import { leaderboard, replayRating } from '../../../lib/domain/ranking';
import { z } from 'zod';
import { clubReminderStatements } from '../../../lib/reminder-store';
export const dynamic = 'force-dynamic';
const response = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
function error(e: unknown) { return writeErrorResponse(e); }
const readCache = createClubReadCache();
export async function GET(req: Request) {
    try {
        const user = await getAppUser();
        if (!user)
            return response({ error: '请先登录羽林大会' }, 401);
        const url = new URL(req.url), period = url.searchParams.get('month') ?? month(Date.now());
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period))
            fail('月份无效');
        const year = Number(url.searchParams.get('year') ?? period.slice(0, 4));
        if (!Number.isInteger(year) || year < 2000 || year > 2100)
            fail('年份无效');
        const identity = { userId: user.userId, method: user.method, username: user.username };
        // Authentication precedes every conditional read. Exports always get fresh full data.
        if (url.searchParams.get('export') !== '1' && req.headers.has('If-None-Match')) {
            const version = await clubReadVersion(user.userId);
            const matched=readCache.match(req.headers.get('If-None-Match'), version, identity, period, year, Date.now());
            if (matched) {
                return new Response(null, { status: 304, headers: { 'Cache-Control': 'no-store', 'ETag': matched } });
            }
        }
        const s = await loadClubState();
        if (!s.settings.initialized)
            return response({ setup: true, user: { name: user.displayName, email: user.email } });
        const a = s.accounts.find(a => a.id === user.userId);
        if (!a) {
            if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
                return response({ error: '请联系管理员创建登录账号' }, 403);
            return response({ join: true, user: { name: user.displayName } });
        }
        if (url.searchParams.get('export') === '1') {
            if (a.role !== 'admin')
                return response({ error: '403: 仅管理员可以导出' }, 403);
            return new Response(JSON.stringify(privateEventState(s, a), null, 2), { headers: { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="club-export.json"', 'Cache-Control': 'no-store' } });
        }
        const credentials = a.role === 'admin' ?
            (await raw().prepare('SELECT id AS accountId,username,username_changed_at AS usernameChangedAt FROM password_credentials').all<{
                accountId: string;
                username: string;
                usernameChangedAt: number | null;
            }>()).results :
            [await raw().prepare('SELECT id AS accountId,username,username_changed_at AS usernameChangedAt FROM password_credentials WHERE id=?').bind(a.id).first<{
                    accountId: string;
                    username: string;
                    usernameChangedAt: number | null;
                }>()].filter((c): c is {
                accountId: string;
                username: string;
                usernameChangedAt: number | null;
            } => c !== null);
        const ownCredential = credentials.find(c => c.accountId === a.id) ?? null, ownUsername = ownCredential?.username ?? null, owner = isClubOwner(s, a), now = Date.now();
        const data: ClubData = { ...projectClubState(s, a, period, year, now), loginAccounts: a.role === 'admin' ? credentials : [], auth: { method: user.method, username: ownUsername, passwordEnabled: !!ownCredential, isOwner: owner, canChangeUsername: canChangeOwnUsername(owner, ownCredential), usernameChangedAt: ownCredential?.usernameChangedAt ?? null } };
        const token = readCache.remember({ revision: s.revision, settings: s.settings, account: a, profileRestrictions:s.profileRestrictions }, identity, period, year, clubViewValidUntil(s, a, now), now);
        return Response.json(data, { headers: { 'Cache-Control': 'no-store', ...(token ? { 'ETag': token } : {}) } });
    }
    catch (e) {
        return error(e);
    }
    finally {
        await releaseRejectedWriteBody(req);
    }
}
export async function POST(req: Request) {
    try {
        assertWriteRequest(req);
        const ip = trustedClientIP(req);
        await cleanExpiredRateLimits();
        await consumeRateLimit('club-ip:' + ip, 600, 5 * 60000, { message: '当前网络操作较多，请稍后重试' });
        const user = await getAppUser();
        if (!user)
            return response({ error: '请先登录' }, 401);
        await consumeRateLimit('club-actor:' + user.userId, 120, 5 * 60000, { message: '操作较频繁，请稍后再试' });
        const body = z.object({ action: z.string().max(40), payload: z.unknown(), requestId: z.string().uuid(), revision: z.number().int().nonnegative().optional(), actor: z.string().min(1).max(200).optional() }).parse(await readJsonBody(req));
        // requestId is only unique per account: a write resent after the browser switched accounts must not run as the new account.
        if (body.actor !== undefined && body.actor !== user.userId)
            return response({ error: '登录账号已切换，本次操作未保存。请确认当前账号后再操作', actorMismatch: true }, 409);
        const key = user.userId + ':' + body.requestId;
        if (body.action === 'friend' || body.action === 'event') {
            const account = await raw().prepare('SELECT role FROM accounts WHERE id=?').bind(user.userId).first<{
                role: string;
            }>();
            if (!account)
                return response({ error: '请先加入群组' }, 403);
            if (await committed(key))
                return response({ ok: true, duplicate: true });
            await reserveDailyCreation(user.userId, body.requestId, body.action, account.role === 'admin');
        }
        for (let attempt = 0; attempt < 5; attempt++) {
            const s = await loadClubState();
            const previous = structuredClone(s);
            let a = s.accounts.find(a => a.id === user.userId);
            if (await committed(key))
                return response({ ok: true, duplicate: true });
            if (body.action === 'initialize' || body.action === 'join') {
                if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(req.url).hostname))
                    fail('403: 请联系管理员创建账号，网站不开放自行注册');
                const p = z.object({ name: z.string().trim().min(1).max(150), invite: z.string().min(8).max(100) }).parse(body.payload);
                if (a)
                    return response({ ok: true });
                if (body.action === 'initialize' && !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(req.url).hostname))
                    fail('403: 请联系现有管理员开通群组');
                if (body.action === 'initialize' && s.settings.initialized)
                    fail('群组已初始化');
                if (body.action === 'join' && (!s.settings.initialized || await digest(p.invite) !== s.settings.inviteHash))
                    fail('邀请码无效');
                const playerId = crypto.randomUUID();
                a = { id: user.userId, email: user.email, role: body.action === 'initialize' ? 'admin' : 'member', playerId };
                s.accounts.push(a);
                s.players.push({ id: playerId, ownerId: a.id, name: p.name, initialRating: 1000, rating: 1000, ratedGames: 0, enabled: true, ratingReason: '新成员默认初值' });
                if (body.action === 'initialize') {
                    s.settings.initialized = true;
                    s.settings.ownerAccountId = a.id;
                    s.settings.inviteHash = await digest(p.invite);
                }
                s.audits.push({ id: crypto.randomUUID(), at: Date.now(), actor: a.id, action: body.action, reason: 'ChatGPT 已验证身份' });
            }
            else {
                if (!a)
                    return response({ error: '403: 请先加入群组' }, 403);
                if (!['register', 'cancel', 'courtRegister', 'courtCancel', 'friend', 'profile', 'shuttleVote', 'pointsModeVote', 'feePaid'].includes(body.action) && body.revision !== s.revision)
                    fail('409: 数据已更新，请刷新后重试');
                const preview = await apply(s, a, body.action, body.payload, Date.now());
                if (body.action === 'historyPreview' && preview)
                    return response({ preview: { input: body.payload, leaderboard: leaderboard(preview, z.object({ season: z.string() }).parse(body.payload).season), ratingHistory: replayRating(preview) } });
            }
            try {
                await save(s, key, previous, clubReminderStatements(s, previous, a!.id, key, body.action));
                return response({ ok: true, revision: s.revision });
            }
            catch (e) {
                if (String(e).includes('UNIQUE constraint failed: commits') && attempt < 4) {
                    if (!['register', 'cancel', 'courtRegister', 'courtCancel', 'join', 'initialize', 'friend', 'profile', 'shuttleVote', 'pointsModeVote', 'feePaid'].includes(body.action))
                        fail('409: 其他管理员刚刚保存了变更，请刷新重试');
                    continue;
                }
                throw e;
            }
        }
        fail('409: 同时操作较多，请稍后重试');
    }
    catch (e) {
        return error(e);
    }
    finally {
        await releaseRejectedWriteBody(req);
    }
}
