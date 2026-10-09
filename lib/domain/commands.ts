import { parseDomainCommand } from './command-contract';
import { markRanked } from './all-ranked';
import { applyLivePlay, finishLiveMatch } from './live-play';
import { blockedWordsInput, normalizeBlockedWords, restoreMaskedEdits } from './blocked-words';
import { assertPlayerMutable, assertAccountMutable, clubOwnerId, isClubOwner } from './ownership';
import { z } from 'zod';
import { pointGrantInput } from './point-grants';
import { upgradeActivitySignups } from './event-merge';
import { applyCourtSignup } from './court-commands';
import { bookingRows, promoteBooking, promoteLegacy } from './booking-signups';
import { fail, month, type State, type Account, type Event } from './types';
import { propose, validateRound, readyIds } from './grouping';
import { usesAutomaticAttendance, archiveDefaultAttendance } from './attendance';
import { cancellationDeadline, cancellationNeedsApproval } from './cancellation';
import { calculateSettlement } from './money';
import { sameSettlement } from './settlement-state';
import { validScore, replayRating } from './ranking';
import { applySocial, memberSocialActions } from './social-commands';
import { applyShuttles } from './shuttles';
import { applyPointsPlan, defaultPointsMinutes } from './points-plan';
import { applyPointsChoice } from './points-choice';
import { fixedPartnerTeams, proposeFixed } from './fixed-partners';
import { decorateMatch } from './play';
import { findVenue } from '../venues';
import { authorizeEventAction, isEventAction, canManageEvent } from './permissions';
import { businessTimestamp as time } from './timestamp';
const id = () => crypto.randomUUID();
const text = z.string().trim().min(1).max(150), pid = z.string().min(1).max(100), cents = z.number().int().min(0).max(100000000), reason = z.string().trim().min(1).max(500), mode = z.enum(['equal', 'duration', 'interval']);
const rulesSchema = z.object({ win: z.number().int().min(0).max(100), loss: z.number().int().min(-100).max(100), minimum: z.number().int().min(0).max(500), cap: z.number().int().min(0).max(500), target: z.number().int().min(1).max(100), ceiling: z.number().int().min(1).max(150), lead: z.number().int().min(1).max(10), k: z.number().min(1).max(128), algorithm: z.literal('doubles-elo-v1') });
export async function digest(v: string) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v)))).map(x => x.toString(16).padStart(2, '0')).join(''); }
export function authorized(a: Account, action: string) { if (!['register', 'cancel', 'courtRegister', 'courtCancel', 'courtMoveQueue', 'friend', 'event', 'shuttleVote', 'pointsModeVote', ...memberSocialActions].includes(action) && !isEventAction(action) && a.role !== 'admin')
    fail('403: 仅管理员可以执行此操作'); }
const schemas = {
    grantPoints: pointGrantInput,
    profile: z.object({ name: text, playerId: pid.optional() }), friend: z.object({ name: text }),
    event: z.object({ title: text, start: time, end: time, venue: text, address: z.string().max(300), capacity: z.number().int().min(1).max(500), signupDeadline: time.optional(), cancelDeadline: time, note: z.string().max(2000), status: z.enum(['draft', 'open']), bookings: z.array(z.object({ name: text, start: time, end: time, pricing: z.enum(['hourly', 'total']), cents, signupCapacity: z.number().int().min(1).max(500).optional() })).min(1).max(20) }),
    eventStatus: z.object({ eventId: pid, status: z.enum(['draft', 'open', 'locked', 'live', 'ended', 'cancelled']) }),
    deleteEvent: z.object({ eventId: pid, reason }), restoreEvent: z.object({ eventId: pid, reason }),
    eventEdit: z.object({ eventId: pid, title: text, venue: text, address: z.string().max(300), capacity: z.number().int().min(1).max(500), signupDeadline: time.optional(), cancelDeadline: time, note: z.string().max(2000), reason }),
    booking: z.object({ eventId: pid, name: text, start: time, end: time, pricing: z.enum(['hourly', 'total']), cents, signupCapacity: z.number().int().min(1).max(500).optional(), venue: text.optional(), address: z.string().max(300).optional(), reason }), bookingEdit: z.object({ bookingId: pid, name: text, start: time, end: time, pricing: z.enum(['hourly', 'total']), cents, signupCapacity: z.number().int().min(1).max(500).optional(), venue: text.optional(), address: z.string().max(300).optional(), reason }),
    register: z.object({ eventId: pid, playerId: pid, arrival: time, departure: time, note: z.string().max(500) }), cancel: z.object({ eventId: pid, playerId: pid, reason }),
    moveQueue: z.object({ eventId: pid, playerId: pid, beforePlayerId: pid, reason }),
    attendance: z.object({ eventId: pid, playerId: pid, at: time, state: z.enum(['ready', 'paused', 'left']) }),
    attendanceEdit: z.object({ attendanceId: pid, start: time, end: time.nullable(), reason }),
    generate: z.object({ eventId: pid, usePointsWindow: z.boolean().optional(), at: time, duration: z.number().int().min(5).max(90), seed: z.number().int().min(1).max(2147483647) }),
    swap: z.object({ roundId: pid, p1: pid, p2: pid }), moveCourt: z.object({ matchId: pid, courtId: pid }), lock: z.object({ matchId: pid, locked: z.boolean() }), publish: z.object({ roundId: pid }), start: z.object({ roundId: pid, at: time, monthly: z.boolean(), elo: z.boolean(), friendly: z.boolean().optional() }), cancelRound: z.object({ roundId: pid, reason }),
    score: z.object({ matchId: pid, a: z.number().int().min(0).max(150), b: z.number().int().min(0).max(150), end: time.optional(), reason, games: z.array(z.object({ a: z.number().int().min(0).max(150), b: z.number().int().min(0).max(150) })).min(1).max(3).optional() }), void: z.object({ matchId: pid, reason, status: z.enum(['cancelled', 'forfeit']) }), matchScoring: z.object({ matchId: pid, monthly: z.boolean(), elo: z.boolean(), reason }),
    cost: z.object({ eventId: pid, type: z.enum(['ball', 'other']), name: text, pricing: z.enum(['tube', 'unit', 'total']), cents, tubeCount: z.number().int().min(1).max(100).default(1), used: z.number().int().min(0).max(10000), start: time.nullable(), end: time.nullable(), bearer: z.enum(['members', 'subsidy']), reason }),
    costOverride: z.object({ costId: pid, reason, segments: z.array(z.object({ start: time, end: time, cents })).min(1).max(100) }),
    bookingBearer: z.object({ bookingId: pid, bearer: z.enum(['members', 'subsidy']), reason }), deleteCost: z.object({ costId: pid, reason }), modes: z.object({ eventId: pid, courtMode: mode, ballMode: mode, reason }),
    exemption: z.object({ eventId: pid, playerId: pid, type: z.enum(['court', 'ball']), mode: z.enum(['none', 'redistribute', 'subsidy']), reason }),
    feeRecipient: z.object({ eventId: pid, name: z.string().trim().min(1).max(80), phone: z.string().trim().min(5).max(40).regex(/^\+?[\d ()-]+$/, '电话号码只可包含数字、区号及常用分隔符').refine(v => v.replace(/\D/g, '').length >= 5 && v.replace(/\D/g, '').length <= 20, '请检查电话号码'), reason }),
    notifyFees: z.object({ eventId: pid, settlementId: pid, reason }),
    settle: z.object({ eventId: pid, confirmed: z.boolean(), reason }),
    blockedWords: blockedWordsInput,
    settings: z.object({ name: text, invite: z.string().max(100).refine(v => v === '' || v.length >= 8, '邀请码至少8位，或留空保留'), rules: rulesSchema }), rating: z.object({ playerId: pid, value: z.number().min(0).max(4000), enabled: z.boolean(), reason }), role: z.object({ accountId: pid, role: z.enum(['admin', 'member']), reason }),
    historyPreview: z.object({ season: z.string().regex(/^\d{4}-\d{2}$/), rules: rulesSchema }), historyRules: z.object({ season: z.string().regex(/^\d{4}-\d{2}$/), rules: rulesSchema, reason }),
};
export async function apply(s: State, a: Account, action: string, input: unknown, now: number) {
    authorized(a, action);
    input = restoreMaskedEdits(s, a, action, input);
    if (await applyLivePlay(s, a, action, input, now))
        return null;
    if (await applyCourtSignup(s, a, action, input, now))
        return null;
    if (await applyPointsChoice(s, a, action, input, now))
        return null;
    if (await applyPointsPlan(s, a, action, input, now))
        return null;
    if (await applyShuttles(s, a, action, input, now))
        return null;
    if (await applySocial(s, a, action, input, now))
        return null;
    const command = parseDomainCommand(schemas, action, input);
    if (!command)
        fail('未知操作');
    const p: Record<string, unknown> = command.payload;
    authorizeEventAction(s, a, action, p);
    if (command.action === 'settings' || command.action === 'historyRules' || command.action === 'historyPreview')
        command.payload.rules.minimum = 0;
    if (command.action === 'event' || command.action === 'eventEdit' || command.action === 'booking' || command.action === 'bookingEdit') {
        const venue = command.payload.venue ? findVenue(command.payload.venue) : undefined;
        if (venue) {
            command.payload.venue = venue.name;
            command.payload.address = venue.address;
        }
    }
    const before = ['score', 'void', 'matchScoring', 'historyRules', 'rating', 'attendanceEdit'].includes(action) ? { matches: structuredClone(s.matches.filter(m => m.id === p.matchId)), attendance: structuredClone(s.attendance.filter(a => a.id === p.attendanceId)), seasons: structuredClone(s.seasons.filter(x => x.id === p.season)), players: structuredClone(s.players.filter(x => x.id === p.playerId)) } : undefined;
    const event = (e: string) => s.events.find(x => x.id === e && x.deletedAt === undefined) ?? fail('活动不存在或已删除');
    const player = (p: string) => s.players.find(x => x.id === p) ?? fail('参赛者不存在');
    const own = (p: string) => { if (a.role !== 'admin' && player(p).ownerId !== a.id)
        fail('403: 只能管理自己及自己代报的朋友'); };
    const reg = (e: string, p: string) => s.registrations.find(r => r.eventId === e && r.playerId === p) ?? fail('未找到报名');
    const round = (r: string) => s.rounds.find(x => x.id === r) ?? fail('轮次不存在');
    switch (command.action) {
        case 'grantPoints': {
            const p = command.payload;
            if (!isClubOwner(s, a))
                fail('403: 只有群主可以调整积分');
            if (!player(p.playerId).enabled)
                fail('该球友已停用，不能调整积分');
            break;
        }
        case 'profile': {
            const p = command.payload;
            const target = p.playerId ?? a.playerId;
            assertPlayerMutable(s, a, target);
            player(target).name = p.name;
            break;
        }
        case 'friend': {
            const p = command.payload;
            s.players.push({ id: id(), ownerId: a.id, name: p.name, initialRating: 1000, rating: 1000, ratedGames: 0, enabled: true, ratingReason: '新成员默认初值' });
            break;
        }
        case 'event': {
            const p = command.payload;
            if (p.end <= p.start || p.cancelDeadline > p.end)
                fail('请检查活动起止时间');
            for (const b of p.bookings)
                checkBooking(p, b);
            const { bookings, ...details } = p;
            const e: Event = { ...details, signupDeadline: p.end, cancelDeadline: cancellationDeadline(p), id: id(), creatorId: a.id, attendanceMode: 'automatic', courtMode: 'interval', ballMode: 'interval' };
            e.pointsPlan = { start: e.start, end: e.start + defaultPointsMinutes(e) * 60000, roundMinutes: 15 };
            s.events.push(e);
            for (const b of bookings)
                s.bookings.push({ ...b, signupCapacity: b.signupCapacity ?? e.capacity, id: id(), eventId: e.id });
            break;
        }
        case 'eventStatus': {
            const p = command.payload;
            const e = event(p.eventId);
            if (p.status === 'cancelled' && s.matches.some(m => m.eventId === e.id && m.status === 'playing'))
                fail('请先结束或作废进行中的比赛');
            if (p.status === 'cancelled' && e.status !== 'cancelled')
                for (const r of s.registrations.filter(r => r.eventId === e.id && r.status === 'confirmed'))
                    archiveDefaultAttendance(s, e, r.playerId, now);
            e.status = p.status;
            break;
        }
        case 'deleteEvent': {
            const p = command.payload;
            const e = s.events.find(e => e.id === p.eventId)!;
            if (e.deletedAt !== undefined)
                return null;
            if (s.matches.some(m => m.eventId === e.id && m.status === 'playing'))
                fail('请先结束或作废正在进行的比赛，再删除活动');
            e.deletedAt = now;
            e.deletedBy = a.id;
            break;
        }
        case 'restoreEvent': {
            const p = command.payload;
            const e = s.events.find(e => e.id === p.eventId)!;
            if (e.deletedAt === undefined)
                return null;
            if (e.mergedInto)
                upgradeActivitySignups(s, e);
            delete e.deletedAt;
            delete e.deletedBy;
            break;
        }
        case 'eventEdit': {
            const p = command.payload;
            const e = event(p.eventId);
            if (p.capacity < s.registrations.filter(r => r.eventId === e.id && r.status === 'confirmed' && !r.bookingSignups).length)
                fail('上限不能低于当前正式人数，请先调整报名名单');
            Object.assign(e, { title: p.title, venue: p.venue, address: p.address, capacity: p.capacity, cancelDeadline: cancellationDeadline(e), note: p.note });
            promote(s, e, now);
            break;
        }
        case 'booking': {
            const p = command.payload;
            const e = event(p.eventId);
            if (p.end <= p.start)
                fail('结束必须晚于开始');
            if (s.bookings.filter(b => b.eventId === e.id).length >= 100)
                fail('每次活动最多100个场地时段');
            if (s.bookings.some(b => b.eventId === e.id && b.name === p.name && (b.venue ?? e.venue) === (p.venue ?? e.venue) && b.start < p.end && b.end > p.start))
                fail('同一场地预约时段不能重叠');
            s.bookings.push({ ...p, signupCapacity: p.signupCapacity ?? e.capacity, id: id() });
            e.start = Math.min(e.start, p.start);
            e.end = Math.max(e.end, p.end);
            e.cancelDeadline = cancellationDeadline(e);
            break;
        }
        case 'bookingEdit': {
            const p = command.payload;
            const b = s.bookings.find(x => x.id === p.bookingId) ?? fail('场地预约不存在');
            const e = event(b.eventId);
            if (p.end <= p.start)
                fail('结束必须晚于开始');
            const slots = bookingRows(s, b.id);
            if ((p.signupCapacity ?? b.signupCapacity ?? e.capacity) < slots.filter(x => x.status === 'confirmed').length)
                fail('上限不能低于本场正式人数');
            if (slots.some(x => x.arrival < p.start || x.departure > p.end))
                fail('已有报名时间超出新时段，请先调整报名');
            if (s.bookings.some(x => x.id !== b.id && x.eventId === e.id && x.name === p.name && (x.venue ?? e.venue) === (p.venue ?? b.venue ?? e.venue) && x.start < p.end && x.end > p.start))
                fail('同一场地预约时段不能重叠');
            if (s.matches.some(m => m.courtId === b.id && ['published', 'playing'].includes(m.status) && ((m.start ?? s.rounds.find(r => r.id === m.roundId)!.start) < p.start || (m.start ?? s.rounds.find(r => r.id === m.roundId)!.start) + s.rounds.find(r => r.id === m.roundId)!.duration * 60000 > p.end)))
                fail('调整时段与已发布或进行中的比赛冲突');
            Object.assign(b, { name: p.name, start: p.start, end: p.end, pricing: p.pricing, cents: p.cents, ...(p.venue !== undefined ? { venue: p.venue, address: p.address ?? '' } : {}), ...(p.signupCapacity !== undefined ? { signupCapacity: p.signupCapacity } : {}) });
            e.start = Math.min(e.start, p.start);
            e.end = Math.max(e.end, p.end);
            e.cancelDeadline = cancellationDeadline(e);
            promoteBooking(s, e, b, now);
            break;
        }
        case 'register': {
            const p = command.payload;
            const e = event(p.eventId), manager = canManageEvent(a, e);
            if (!manager)
                own(p.playerId);
            if (!player(p.playerId).enabled)
                fail('成员已停用');
            if (!manager && e.status !== 'open')
                fail('当前活动未开放报名');
            if (!manager && now >= e.end)
                fail('活动时段已结束');
            if (['ended', 'cancelled'].includes(e.status))
                fail('活动已结束');
            if (p.arrival < e.start || p.departure > e.end || p.departure <= p.arrival)
                fail('参加时间应在活动时间内');
            const old = s.registrations.find(r => r.eventId === e.id && r.playerId === p.playerId);
            if (old?.bookingSignups)
                fail('请在对应的场地时段修改接龙');
            if (old && old.status !== 'cancelled') {
                old.arrival = p.arrival;
                old.departure = p.departure;
                old.note = p.note;
            }
            else {
                const r = { ...p, id: old?.id ?? id(), sequence: Math.max(0, ...s.registrations.filter(r => r.eventId === e.id).map(r => r.sequence)) + 1, status: 'waitlist' as const, registeredAt: now, joinedAsWaitlist: s.registrations.filter(r => r.eventId === e.id && r.status === 'confirmed' && !r.bookingSignups).length >= e.capacity, cancelRequested: false, courtExempt: { mode: 'none' as const, reason: '' }, ballExempt: { mode: 'none' as const, reason: '' } };
                if (old)
                    s.registrations.splice(s.registrations.indexOf(old), 1, r);
                else
                    s.registrations.push(r);
                promote(s, e, now);
            }
            break;
        }
        case 'cancel': {
            const p = command.payload;
            const e = event(p.eventId), manager = canManageEvent(a, e);
            if (!manager)
                own(p.playerId);
            const r = reg(e.id, p.playerId);
            if (r.bookingSignups)
                fail('请在对应的场地时段取消接龙');
            if (r.status === 'cancelled')
                return;
            if (cancellationNeedsApproval(e, now, manager)) {
                r.cancelRequested = true;
            }
            else {
                if (s.matches.some(m => m.status === 'playing' && m.eventId === e.id && [...m.a, ...m.b].includes(p.playerId)))
                    fail('成员正在比赛，请先完成比赛');
                archiveDefaultAttendance(s, e, p.playerId, now);
                r.status = 'cancelled';
                r.cancelRequested = false;
                for (const at of s.attendance.filter(x => x.eventId === e.id && x.playerId === p.playerId && x.end === null)) {
                    at.end = Math.max(at.start, Math.min(now, e.end));
                    at.state = 'left';
                }
                promote(s, e, now);
            }
            break;
        }
        case 'moveQueue': {
            const p = command.payload;
            const e = event(p.eventId);
            const r = reg(e.id, p.playerId), before = reg(e.id, p.beforePlayerId);
            if (r.status !== 'waitlist' || before.status !== 'waitlist')
                fail('仅支持调整候补顺序');
            const queue = s.registrations.filter(r => r.eventId === e.id && r.status === 'waitlist').sort((a, b) => a.sequence - b.sequence).filter(x => x !== r);
            queue.splice(queue.indexOf(before), 0, r);
            const start = Math.max(0, ...s.registrations.filter(x => x.eventId === e.id && x.status !== 'waitlist').map(x => x.sequence)) + 1;
            queue.forEach((r, i) => r.sequence = start + i);
            break;
        }
        case 'attendance': {
            const p = command.payload;
            const e = event(p.eventId);
            if (usesAutomaticAttendance(e))
                fail('本活动按正式报名时间默认参加，无需更新出勤状态');
            if (reg(e.id, p.playerId).status !== 'confirmed')
                fail('只有正式成员可以签到');
            if (p.at < e.start - 3600000 || p.at > e.end)
                fail('出勤时间应在活动时段内');
            const active = s.attendance.find(x => x.eventId === e.id && x.playerId === p.playerId && x.end === null);
            if (p.state === 'left') {
                if (!active)
                    fail('成员尚未签到');
                if (p.at <= active.start)
                    fail('签退必须晚于签到');
                if (s.matches.some(m => m.status === 'playing' && [...m.a, ...m.b].includes(p.playerId)))
                    fail('请先结束该成员正在进行的比赛');
                active.end = p.at;
                active.state = 'left';
            }
            else if (active)
                active.state = p.state;
            else {
                if (s.attendance.some(x => x.eventId === e.id && x.playerId === p.playerId && (x.end ?? e.end) > p.at))
                    fail('出勤时段不能重叠');
                s.attendance.push({ id: id(), eventId: e.id, playerId: p.playerId, start: p.at, end: null, state: p.state });
            }
            break;
        }
        case 'attendanceEdit': {
            const p = command.payload;
            const at = s.attendance.find(x => x.id === p.attendanceId) ?? fail('出勤不存在');
            const e = event(at.eventId);
            if (usesAutomaticAttendance(e))
                fail('本活动按正式报名时间默认参加，请修改接龙参加时间');
            if (p.start < e.start - 3600000 || (p.end ?? e.end) > e.end || (p.end ?? e.end) <= p.start)
                fail('出勤时段无效');
            if (s.attendance.some(x => x.id !== at.id && x.eventId === e.id && x.playerId === at.playerId && x.start < (p.end ?? e.end) && (x.end ?? e.end) > p.start))
                fail('出勤时段重叠');
            at.start = p.start;
            at.end = p.end;
            if (p.end !== null)
                at.state = 'left';
            break;
        }
        case 'generate': {
            const p = command.payload;
            const e = event(p.eventId);
            if (e.livePlay?.enabled)
                fail('本活动使用实时排场，请在比赛页面开始或恢复排场');
            if (p.usePointsWindow && !e.pointsPlan)
                e.pointsPlan = { start: e.start, end: e.start + defaultPointsMinutes(e) * 60000, roundMinutes: 15 };
            if (['cancelled', 'ended', 'draft'].includes(e.status))
                fail('请先开放或开始活动');
            if (s.rounds.some(r => r.eventId === e.id && r.pointsSlot !== undefined && ['draft', 'published', 'playing'].includes(r.status)))
                fail('已有预排积分赛，请按赛程完成或取消预排轮次，再逐轮生成');
            const old = s.rounds.find(x => x.eventId === e.id && x.status === 'draft');
            const locked = s.matches.filter(m => m.roundId === old?.id && m.locked);
            validateRound(s, e.id, p.at, p.duration, locked);
            const eligible = readyIds(s, e.id, p.at, p.duration);
            if (old) {
                s.matches = s.matches.filter(m => m.roundId !== old.id);
                s.rounds = s.rounds.filter(r => r.id !== old.id);
            }
            const copy = structuredClone(s);
            copy.matches.push(...locked.map(m => ({ ...m, status: 'playing' as const })));
            let courts: {
                courtId: string;
                a: string[];
                b: string[];
            }[] = [];
            try {
                const fixed = e.pointsChoice?.selectedMode === 'fixed';
                const teams = fixed ? (e.pointsChoice?.teams ?? fixedPartnerTeams(copy, e)) : undefined;
                courts = teams ? proposeFixed(copy, e, p.at, p.duration, p.seed, teams).courts : propose(copy, e, p.at, p.duration, p.seed).courts;
                if (fixed)
                    e.pointsChoice!.teams = teams;
            }
            catch (error) {
                if (!locked.length)
                    throw error;
            }
            const playing = [...locked.flatMap(m => [...m.a, ...m.b]), ...courts.flatMap(m => [...m.a, ...m.b])];
            const r = { id: old?.id ?? id(), eventId: e.id, start: p.at, duration: p.duration, status: 'draft' as const, eligible, rest: eligible.filter(id => !playing.includes(id)), seed: p.seed };
            s.rounds.push(r);
            for (const m of locked)
                s.matches.push({ ...m, roundId: r.id });
            for (const m of courts)
                s.matches.push({ ...m, id: id(), eventId: e.id, roundId: r.id, status: 'draft', start: null, end: null, scoreA: null, scoreB: null, monthly: true, elo: true, locked: false, enteredBy: null, games: [] });
            for (const m of s.matches.filter(m => m.roundId === r.id && !m.locked))
                decorateMatch(s, e, m);
            break;
        }
        case 'swap': {
            const p = command.payload;
            const r = round(p.roundId);
            if (event(r.eventId).pointsChoice?.selectedMode === 'fixed')
                fail('固定搭档不能单轮交换成员，请在开打前重新分配搭档');
            if (r.status !== 'draft')
                fail('仅可交换草稿');
            const ms = s.matches.filter(m => m.roundId === r.id);
            const has = (m: State['matches'][number], p: string) => [...m.a, ...m.b].includes(p);
            if (ms.some(m => m.locked && (has(m, p.p1) || has(m, p.p2))))
                fail('请先解除锁定');
            if (!r.eligible.includes(p.p1) || !r.eligible.includes(p.p2))
                fail('选手不在本轮可用名单');
            for (const m of ms) {
                m.a = m.a.map(x => x === p.p1 ? p.p2 : x === p.p2 ? p.p1 : x);
                m.b = m.b.map(x => x === p.p1 ? p.p2 : x === p.p2 ? p.p1 : x);
            }
            r.rest = r.rest.map(x => x === p.p1 ? p.p2 : x === p.p2 ? p.p1 : x);
            validateRound(s, r.eventId, r.start, r.duration, ms);
            for (const m of ms)
                decorateMatch(s, event(r.eventId), m);
            break;
        }
        case 'lock': {
            const p = command.payload;
            const m = s.matches.find(x => x.id === p.matchId) ?? fail('比赛不存在');
            if (round(m.roundId).status !== 'draft')
                fail('仅可锁定草稿');
            m.locked = p.locked;
            break;
        }
        case 'moveCourt': {
            const p = command.payload;
            const m = s.matches.find(x => x.id === p.matchId) ?? fail('比赛不存在');
            const r = round(m.roundId);
            if (r.status !== 'draft' || m.locked)
                fail('仅可修改未锁定草稿');
            m.courtId = p.courtId;
            validateRound(s, m.eventId, r.start, r.duration, s.matches.filter(x => x.roundId === r.id));
            break;
        }
        case 'publish': {
            const p = command.payload;
            const r = round(p.roundId);
            if (r.status !== 'draft')
                fail('轮次已发布');
            const ms = s.matches.filter(m => m.roundId === r.id);
            validateRound(s, r.eventId, r.start, r.duration, ms);
            r.status = 'published';
            ms.forEach(m => m.status = 'published');
            break;
        }
        case 'start': {
            const p = command.payload;
            const r = round(p.roundId);
            if (r.status !== 'published')
                fail('请先发布本轮');
            const e = event(r.eventId);
            if (['draft', 'ended', 'cancelled'].includes(e.status))
                fail('本活动尚未开放或已经结束，请先确认活动状态');
            if (r.pointsSlot !== undefined && s.rounds.some(other => other.eventId === e.id && other.pointsSlot !== undefined && other.pointsSlot < (r.pointsSlot ?? 0) && ['draft', 'published', 'playing'].includes(other.status)))
                fail('请按预排顺序开赛，先结束或取消前面的轮次');
            if (r.pointsSlot !== undefined && s.matches.some(m => m.eventId === e.id && m.status === 'playing'))
                fail('请先录入当前轮全部比赛的结果，再开始下一轮');
            const ms = s.matches.filter(m => m.roundId === r.id);
            validateRound(s, r.eventId, p.at, r.duration, ms);
            r.start = p.at;
            r.status = 'playing';
            const season = month(p.at);
            if (!s.seasons.some(x => x.id === season))
                s.seasons.push({ id: season, rules: { ...s.settings.rules }, version: 1 });
            ms.forEach(m => { m.start = p.at; m.status = 'playing'; markRanked(m); });
            break;
        }
        case 'cancelRound': {
            const p = command.payload;
            const r = round(p.roundId);
            if (!['draft', 'published'].includes(r.status))
                fail('只能取消尚未开始的轮次');
            r.status = 'cancelled';
            s.matches.filter(m => m.roundId === r.id).forEach(m => m.status = 'cancelled');
            break;
        }
        case 'score': {
            const p = command.payload;
            const m = s.matches.find(x => x.id === p.matchId) ?? fail('比赛不存在');
            if (!['playing', 'complete'].includes(m.status) || m.start === null)
                fail('比赛尚未开始');
            const rules = s.seasons.find(x => x.id === month(m.start!))?.rules ?? s.settings.rules;
            const games = p.games ?? [{ a: p.a, b: p.b }];
            if (round(m.roundId).live && games.length !== 1)
                fail('实时排场按一局结束，请每局录入一次比分');
            if (m.playMode === 'koc' && games.length > 1)
                fail('个人轮转采用一局制，每局结束后重新排搭档');
            if (games.some(g => !validScore(g.a, g.b, rules)))
                fail('终局比分不符合目标分、领先分与封顶规则');
            if (games.length > 1) {
                let aw = 0, bw = 0;
                for (let i = 0; i < games.length; i++) {
                    if (aw === 2 || bw === 2)
                        fail('比赛已分胜负，不能继续添加局');
                    if (games[i].a > games[i].b) aw++; else bw++;
                }
                if (Math.max(aw, bw) !== 2)
                    fail('三局两胜须有一方赢两局');
            }
            const firstCompletion = m.status === 'playing', matchEvent = event(m.eventId);
            if (p.end === undefined || (matchEvent.livePlay?.enabled && firstCompletion))
                p.end = m.end ?? Math.min(matchEvent.end, Math.max(now, m.start + 1));
            if (p.end <= m.start || p.end > matchEvent.end)
                fail('结束时间必须晚于开赛且在活动时间内');
            m.games = games;
            m.scoreA = games.length > 1 ? games.filter(g => g.a > g.b).length : games[0].a;
            m.scoreB = games.length > 1 ? games.filter(g => g.b > g.a).length : games[0].b;
            m.end = p.end;
            m.status = 'complete';
            m.enteredBy = a.id;
            markRanked(m);
            const r = round(m.roundId);
            if (s.matches.filter(x => x.roundId === r.id).every(x => ['complete', 'cancelled', 'forfeit'].includes(x.status)))
                r.status = 'complete';
            replayRating(s);
            if (firstCompletion)
                finishLiveMatch(s, matchEvent, m, now);
            break;
        }
        case 'matchScoring': {
            const p = command.payload;
            const m = s.matches.find(x => x.id === p.matchId) ?? fail('比赛不存在');
            if (!['playing', 'complete'].includes(m.status))
                fail('只可修正已开赛对局的计分方式');
            if (!p.monthly)
                fail('网站对局统一计入积分赛，不能关闭积分');
            markRanked(m);
            replayRating(s);
            break;
        }
        case 'void': {
            const p = command.payload;
            const m = s.matches.find(x => x.id === p.matchId) ?? fail('比赛不存在');
            const wasPlaying = m.status === 'playing';
            m.status = p.status;
            const r = round(m.roundId);
            if (s.matches.filter(x => x.roundId === r.id).every(x => ['complete', 'cancelled', 'forfeit'].includes(x.status)))
                r.status = 'complete';
            replayRating(s);
            if (wasPlaying)
                finishLiveMatch(s, event(m.eventId), m, now);
            break;
        }
        case 'cost': {
            const p = command.payload;
            const e = event(p.eventId);
            if ((p.start === null) !== (p.end === null))
                fail('耗球开始与结束时间必须同时填写');
            if (p.start !== null && p.end !== null && (p.start < e.start || p.end > e.end || p.end <= p.start))
                fail('费用时段无效');
            if (p.type === 'ball' && p.pricing !== 'unit')
                fail('耗球请按单颗价格和消耗颗数录入；如仍看到按筒计价，请刷新页面后重试');
            s.costs.push({ ...p, ...(p.type === 'ball' ? {tubeCount: 1} : {}), id: id() });
            break;
        }
        case 'costOverride': {
            const p = command.payload;
            const c = s.costs.find(c => c.id === p.costId) ?? fail('费用不存在');
            if (c.type !== 'ball')
                fail('仅支持球费时段修正');
            const e = event(c.eventId);
            const sorted = [...p.segments].sort((a, b) => a.start - b.start);
            for (let i = 0; i < sorted.length; i++) {
                const x = sorted[i];
                if (x.end <= x.start || x.start < e.start || x.end > e.end || (i > 0 && x.start < sorted[i - 1].end))
                    fail('球费时段不能无效或重叠');
            }
            c.overrides = sorted;
            calculateSettlement(s, e, now);
            break;
        }
        case 'bookingBearer': {
            const p = command.payload;
            const b = s.bookings.find(x => x.id === p.bookingId) ?? fail('场地预约不存在');
            b.bearer = p.bearer;
            break;
        }
        case 'deleteCost': {
            const p = command.payload;
            s.costs = s.costs.filter(c => c.id !== p.costId);
            break;
        }
        case 'modes': {
            const p = command.payload;
            const e = event(p.eventId);
            e.courtMode = p.courtMode;
            e.ballMode = p.ballMode;
            break;
        }
        case 'exemption': {
            const p = command.payload;
            const r = reg(p.eventId, p.playerId);
            r[p.type === 'court' ? 'courtExempt' : 'ballExempt'] = { mode: p.mode, reason: p.reason };
            break;
        }
        case 'feeRecipient': {
            const p = command.payload;
            event(p.eventId).feeRecipient = { name: p.name, phone: p.phone };
            break;
        }
        case 'notifyFees': {
            const p = command.payload;
            const e = event(p.eventId), latest = s.settlements.filter(x => x.eventId === e.id && x.confirmed).sort((a, b) => b.version - a.version)[0];
            if (!latest)
                fail('请先确认费用分摊，再通知球友');
            if (latest.id !== p.settlementId)
                fail('409: 分摊版本已更新，请刷新后再通知');
            break;
        }
        case 'settle': {
            const p = command.payload;
            const e = event(p.eventId);
            if (p.confirmed && now < e.end && (usesAutomaticAttendance(e) || s.attendance.some(x => x.eventId === e.id && x.end === null)))
                fail('请等待活动结束，再确认正式分摊');
            const result = calculateSettlement(s, e, now);
            if (p.confirmed && result.unallocated)
                fail('仍有待分配费用，请通过费用承担设置指定群补贴或核对参加时间');
            const latest = s.settlements.filter(x => x.eventId === e.id && x.confirmed).sort((a, b) => b.version - a.version)[0];
            if (p.confirmed && latest && sameSettlement(result, latest))
                return null;
            s.settlements.push({ ...result, id: id(), created: now, version: Math.max(0, ...s.settlements.filter(x => x.eventId === e.id).map(x => x.version)) + 1, confirmed: p.confirmed, reason: p.reason });
            break;
        }
        case 'blockedWords': {
            const p = command.payload;
            s.settings.blockedWords = normalizeBlockedWords(p.words);
            break;
        }
        case 'settings': {
            const p = command.payload;
            if (p.rules.ceiling < p.rules.target || p.rules.lead > p.rules.target)
                fail('比赛规则无效');
            s.settings.name = p.name;
            if (p.invite)
                s.settings.inviteHash = await digest(p.invite);
            s.settings.rules = p.rules;
            break;
        }
        case 'rating': {
            const p = command.payload;
            assertPlayerMutable(s, a, p.playerId);
            const pl = player(p.playerId);
            pl.initialRating = p.value;
            pl.ratingReason = p.reason;
            pl.enabled = p.enabled;
            replayRating(s);
            break;
        }
        case 'role': {
            const p = command.payload;
            if (clubOwnerId(s) && !isClubOwner(s, a))
                fail('403: 只有群主可以调整账号权限');
            const acc = s.accounts.find(x => x.id === p.accountId) ?? fail('账号不存在');
            assertAccountMutable(s, a, acc.id);
            if (acc.id === clubOwnerId(s))
                fail('403: 群主拥有固定最高权限，不能降级');
            if (acc.role === 'admin' && p.role === 'member' && s.accounts.filter(x => x.role === 'admin').length === 1)
                fail('至少保留一位管理员');
            acc.role = p.role;
            break;
        }
        case 'historyRules': {
            const p = command.payload;
            if (p.rules.ceiling < p.rules.target)
                fail('比赛规则无效');
            const season = s.seasons.find(x => x.id === p.season) ?? fail('赛季不存在');
            season.rules = p.rules;
            season.version = (season.version ?? 1) + 1;
            replayRating(s);
            break;
        }
        case 'historyPreview': {
            const p = command.payload;
            const copy = structuredClone(s);
            const season = copy.seasons.find(x => x.id === p.season) ?? fail('赛季不存在');
            season.rules = p.rules;
            replayRating(copy);
            return copy;
            break;
        }
    }
    s.audits.push({ id: id(), at: now, actor: a.id, action, reason: action === 'blockedWords' ? '更新屏蔽词' : typeof p.reason === 'string' ? p.reason : `${action} 操作`, changes: action === 'settings' ? { name: p.name, rules: p.rules } : before ? { before, input: p } : p });
    return null;
}
function checkBooking(e: {
    start: number;
    end: number;
}, b: {
    start: number;
    end: number;
}) { if (b.start < e.start || b.end > e.end || b.end <= b.start)
    fail('场地预约必须在活动时间内且结束晚于开始'); }
export function promote(s: State, e: Event, now = Date.now()) { promoteLegacy(s, e, now); }

