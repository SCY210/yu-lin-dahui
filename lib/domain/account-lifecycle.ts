import {clubOwnerId, isClubOwner} from './ownership';
import {fail, type State, type Account} from './types';
import {promoteLegacy, promoteBooking} from './booking-signups';

export const deletionGraceMs = 30 * 24 * 60 * 60 * 1000;

export function assertCanDeleteAccount(s: State, account: Account) {
  if (isClubOwner(s, account)) fail('403: 群主账号受保护，请先安排群组所有权交接');
  if (account.role === 'admin' && !s.accounts.some(a => a.id !== account.id && a.role === 'admin')) fail('409: 至少保留一位管理员');
}

export function relinquishAdmin(s: State, account: Account) {
  if (isClubOwner(s, account)) fail('403: 群主拥有固定最高权限，不能自行降级');
  if (account.role !== 'admin') fail('409: 当前账号已是普通成员');
  if (!s.accounts.some(a => a.id !== account.id && a.role === 'admin')) fail('409: 至少保留一位管理员');
  account.role = 'member';
}

/** Retain shared score/cost facts under a fresh, unowned placeholder. */
export function eraseAccount(s: State, accountId: string, now: number) {
  const account = s.accounts.find(a => a.id === accountId) ?? fail('账号不存在');
  assertCanDeleteAccount(s, account);
  const oldPlayerId = account.playerId, replacementId = crypto.randomUUID();
  const identityIds = new Set([accountId, oldPlayerId]);
  const photos = s.photos.filter(p => p.ownerId === accountId || p.playerIds.includes(oldPlayerId));
  const photoIds = new Set(photos.map(p => p.id));
  s.photos = s.photos.filter(p => !photoIds.has(p.id));
  for (const player of s.players) {
    if (player.avatarId && photoIds.has(player.avatarId)) delete player.avatarId;
    if (player.ownerId === accountId) player.ownerId = '';
  }
  const player = s.players.find(p => p.id === oldPlayerId);
  if (player) {
    // Whitelist sporting values only; discard all optional personal fields.
    s.players = s.players.filter(p => p.id !== oldPlayerId);
    s.players.push({id: replacementId, ownerId: '', name: '已注销球友', enabled: false,
      initialRating: player.initialRating, rating: player.rating, ratedGames: player.ratedGames, ratingReason: ''});
  }
  s.accounts = s.accounts.filter(a => a.id !== accountId);
  s.accountNoticeReceipts = s.accountNoticeReceipts.filter(r => r.accountId !== accountId && r.playerId !== oldPlayerId);
  const ownOrderIds = new Set(s.treasureOrders.filter(o => o.accountId === accountId || o.playerId === oldPlayerId).map(o => o.id));
  s.treasureOrders = s.treasureOrders.filter(o => !ownOrderIds.has(o.id));
  s.treasureLedger = s.treasureLedger.filter(l => l.playerId !== oldPlayerId && (!l.orderId || !ownOrderIds.has(l.orderId)));
  for (const row of s.treasureLedger) if (row.actor === accountId) {row.actor = null; row.reason = ''; row.requestId = crypto.randomUUID();}
  for (const row of s.treasureOrders) if (row.handledBy === accountId) delete row.handledBy;
  if (s.settings.feePayees) s.settings.feePayees = s.settings.feePayees.filter(p => p.createdBy !== accountId);
  for (const event of s.events) if (event.creatorId === accountId) {delete event.feeRecipient; event.note = '';}
  s.tagVotes = s.tagVotes.filter(v => v.voterId !== accountId && v.playerId !== oldPlayerId);
  s.awardVotes = s.awardVotes.filter(v => v.voterId !== accountId && v.playerId !== oldPlayerId);
  s.challenges = s.challenges.filter(v => v.challengerId !== oldPlayerId && v.targetId !== oldPlayerId);
  // Audit snapshots can contain emails, usernames, profiles or previous values.
  // Drop entire related snapshots rather than retaining a reversible mapping.
  s.audits = s.audits.filter(a => ![...identityIds].some(id => JSON.stringify(a).includes(id)) && !photos.some(p => JSON.stringify(a).includes(p.id) || JSON.stringify(a).includes(p.key)));
  const futureEvents = new Set(s.events.filter(e => e.start > now).map(e => e.id));
  const affectedFutureEvents = new Set(s.registrations.filter(r => r.playerId === oldPlayerId && futureEvents.has(r.eventId)).map(r => r.eventId));
  s.registrations = s.registrations.filter(r => !(r.playerId === oldPlayerId && futureEvents.has(r.eventId)));
  s.attendance = s.attendance.filter(r => !(r.playerId === oldPlayerId && futureEvents.has(r.eventId)));
  for (const eventId of affectedFutureEvents) {
    const event = s.events.find(e => e.id === eventId)!;
    if (event.deletedAt !== undefined) continue;
    promoteLegacy(s, event, now);
    for (const booking of s.bookings.filter(b => b.eventId === eventId)) promoteBooking(s, event, booking, now);
  }
  // Replace IDs including object keys (settlement shares), then scrub free-text
  // fields belonging to this participant. Other people's shared notes remain.
  const replace = (value: unknown): unknown => {
    if (typeof value === 'string') return value === oldPlayerId ? replacementId : value === accountId ? '' : value;
    if (Array.isArray(value)) return value.map(replace);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key === oldPlayerId ? replacementId : key, replace(item)]));
    return value;
  };
  for (const key of ['events', 'registrations', 'attendance', 'rounds', 'matches', 'settlements', 'payments', 'ratingChanges'] as const) {
    for (const row of s[key]) {
      if ('actor' in row && row.actor === accountId && 'reason' in row) row.reason = '';
      if ('playerId' in row && row.playerId === oldPlayerId) {
        if ('note' in row) row.note = '';
        if ('reason' in row) row.reason = '';
        if ('bookingSignups' in row) row.bookingSignups?.forEach(b => {b.note = ''});
        if ('cancelReason' in row) row.cancelReason = '';
        if ('courtExempt' in row) row.courtExempt.reason = '';
        if ('ballExempt' in row) row.ballExempt.reason = '';
        if ('noticeAcknowledgements' in row) row.noticeAcknowledgements = [];
      }
    }
    (s[key] as unknown[]) = s[key].map(replace);
  }
  // A malformed owner setting must never silently acquire another identity.
  if (clubOwnerId(s) === accountId) fail('403: 群主账号受保护');
  return photos.map(p => p.key);
}
