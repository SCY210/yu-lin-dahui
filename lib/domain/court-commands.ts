import {editReason} from './edit-reason';
import { parseDomainCommand } from './command-contract';
import { z } from 'zod';
import { fail, type Account, type State } from './types';
import { businessTimestamp } from './timestamp';
import { canManageEvent } from './permissions';
import { cancellationNeedsApproval } from './cancellation';
import { archiveDefaultAttendance } from './attendance';
import { archiveBooking, bookingCapacity, bookingRows, promoteBooking, promoteLegacy, syncRegistration } from './booking-signups';
const id = z.string().min(1).max(100), reason = editReason;
const schemas = {
    courtRegister: z.object({ bookingId: id, playerId: id, arrival: businessTimestamp, departure: businessTimestamp, note: z.string().max(500) }),
    courtCancel: z.object({ bookingId: id, playerId: id, reason }),
    courtMoveQueue: z.object({ bookingId: id, playerId: id, beforePlayerId: id, reason }),
};
export async function applyCourtSignup(s: State, a: Account, action: string, input: unknown, now: number) {
    const command = parseDomainCommand(schemas, action, input);
    if (!command)
        return false;
    const p = command.payload;
    const b = s.bookings.find(x => x.id === p.bookingId) ?? fail('场地时段不存在'), e = s.events.find(x => x.id === b.eventId && x.deletedAt === undefined) ?? fail('活动不存在或已删除');
    const manager = canManageEvent(a, e), player = s.players.find(x => x.id === p.playerId) ?? fail('球友不存在');
    if (!manager && player.ownerId !== a.id)
        fail('403: 只能管理自己及自己代报的朋友');
    if (['ended', 'cancelled'].includes(e.status))
        fail('活动已结束');
    let r = s.registrations.find(x => x.eventId === e.id && x.playerId === p.playerId), row = r?.bookingSignups?.find(x => x.bookingId === b.id);
    switch (command.action) {
        case 'courtRegister': {
            const p = command.payload;
            if (!player.enabled)
                fail('成员已停用');
            if (!manager && e.status !== 'open')
                fail('当前活动未开放报名');
            if (!manager && now >= b.end)
                fail('该场地时段已结束');
            if (p.arrival < b.start || p.departure > b.end || p.departure <= p.arrival)
                fail('参加时间必须在所选场地时段内');
            if (r?.bookingSignups?.some(x => x.bookingId !== b.id && x.status !== 'cancelled' && x.arrival < p.departure && x.departure > p.arrival))
                fail('你已报名其他场地的重叠时段，请先取消或调整');
            if (s.matches.some(m => m.eventId === e.id && m.status === 'playing' && [...m.a, ...m.b].includes(player.id)))
                fail('成员正在比赛，请先完成比赛');
            if (!r) {
                r = { id: crypto.randomUUID(), eventId: e.id, playerId: player.id, sequence: Math.max(0, ...s.registrations.filter(x => x.eventId === e.id).map(x => x.sequence)) + 1, status: 'cancelled', arrival: p.arrival, departure: p.departure, note: '', cancelRequested: false, registeredAt: now, joinedAsWaitlist: false, courtExempt: { mode: 'none', reason: '' }, ballExempt: { mode: 'none', reason: '' }, bookingSignups: [] };
                s.registrations.push(r);
            }
            else if (!r.bookingSignups) {
                if (r.status === 'confirmed' && cancellationNeedsApproval(e, now, manager))
                    fail('原活动接龙已过自由取消时间，请先申请取消或由活动创建者调整');
                archiveDefaultAttendance(s, e, r.playerId, now);
                r.bookingSignups = [];
            }
            if (row && row.status !== 'cancelled') {
                // Keep elapsed participation on the original court when editing after play starts.
                if (row.arrival !== p.arrival || row.departure !== p.departure) {
                    if (cancellationNeedsApproval({ ...e, start: b.start }, now, manager) && (p.arrival > row.arrival || p.departure < row.departure))
                        fail('已过自由取消时间，缩短时段请先申请取消或联系活动创建者');
                    archiveBooking(s, e, r, b.id, now);
                    row.registeredAt = Math.max(row.registeredAt, Math.min(now, b.end));
                }
                row.arrival = p.arrival;
                row.departure = p.departure;
                row.note = p.note;
            }
            else {
                row = { bookingId: b.id, status: 'waitlist', sequence: Math.max(0, ...bookingRows(s, b.id).map(x => x.sequence)) + 1, arrival: p.arrival, departure: p.departure, note: p.note, registeredAt: now, joinedAsWaitlist: bookingRows(s, b.id).filter(x => x.status === 'confirmed').length >= bookingCapacity(b, e), cancelRequested: false };
                const old = r.bookingSignups!.findIndex(x => x.bookingId === b.id);
                if (old >= 0)
                    r.bookingSignups![old] = row;
                else
                    r.bookingSignups!.push(row);
            }
            promoteBooking(s, e, b, now);
            syncRegistration(r);
            promoteLegacy(s, e, now);
            break;
        }
        case 'courtCancel': {
            if (!r || !row)
                fail('未找到该场地报名');
            if (row.status === 'cancelled')
                return true;
            if (cancellationNeedsApproval({ ...e, start: b.start }, now, manager)) {
                row.cancelRequested = true;
                syncRegistration(r);
            }
            else {
                if (s.matches.some(m => m.status === 'playing' && m.eventId === e.id && [...m.a, ...m.b].includes(player.id)))
                    fail('成员正在比赛，请先完成比赛');
                archiveBooking(s, e, r, b.id, now);
                row.status = 'cancelled';
                row.cancelRequested = false;
                syncRegistration(r);
                promoteBooking(s, e, b, now);
            }
            break;
        }
        case 'courtMoveQueue': {
            const p = command.payload;
            if (!manager)
                fail('403: 只能管理自己创建的活动');
            const target = s.registrations.find(x => x.eventId === e.id && x.playerId === p.beforePlayerId)?.bookingSignups?.find(x => x.bookingId === b.id);
            if (row?.status !== 'waitlist' || target?.status !== 'waitlist')
                fail('仅支持调整本场候补顺序');
            const queue = s.registrations.flatMap(x => (x.bookingSignups ?? []).filter(y => y.bookingId === b.id && y.status === 'waitlist')).sort((x, y) => x.sequence - y.sequence).filter(x => x !== row);
            queue.splice(queue.indexOf(target), 0, row);
            const first = Math.max(0, ...bookingRows(s, b.id).filter(x => x.status === 'confirmed').map(x => x.sequence)) + 1;
            queue.forEach((x, i) => x.sequence = first + i);
            break;
        }
    }
    s.audits.push({ id: crypto.randomUUID(), at: now, actor: a.id, action, reason: ('reason' in p ? p.reason : undefined) ?? '场地接龙', changes: p });
    return true;
}
