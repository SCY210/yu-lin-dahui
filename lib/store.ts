import { env } from 'cloudflare:workers';
import { emptyState, type State, type Account } from './domain/types';
import { parseStoredObject, PersistenceError } from './persistence-payload';
import type { ClubReadVersion } from './club-read-cache';
import {profileRestrictionsFromConfig} from './profile-policy-config';
const names = ['accounts', 'players', 'events', 'bookings', 'registrations', 'attendance', 'rounds', 'matches', 'costs', 'settlements', 'payments', 'seasons', 'audits', 'ratingChanges', 'challenges', 'tagVotes', 'awardVotes', 'photos'] as const;
export function raw() { if (!env.DB)
    throw new Error('数据库暂不可用，请稍后重试'); return env.DB; }
/** Indexed metadata reads verify freshness and current permissions on every poll. */
export async function clubReadVersion(accountId: string): Promise<ClubReadVersion> {
    const db = raw();
    const result = await db.batch([
        db.prepare('SELECT COALESCE(MAX(revision),0) AS revision FROM commits'),
        db.prepare('SELECT payload FROM settings WHERE id=?').bind('club'),
        db.prepare('SELECT payload FROM accounts WHERE id=?').bind(accountId),
    ]);
    const state = emptyState(), settings = result[1].results[0] as {
        payload: string;
    } | undefined, account = result[2].results[0] as {
        payload: string;
    } | undefined;
    return { profileRestrictions:profileRestrictionsFromConfig(env.PROFILE_GENDER_ONLY_PLAYER_IDS), revision: revisionFrom(result[0].results[0]), settings: settings ? storedSettings(settings.payload) : state.settings, account: account ? storedRecord('accounts', { id: accountId, payload: account.payload }) as Account : null };
}
type TableName = typeof names[number];
type PayloadRow = {
    id: string;
    payload: string;
};
function revisionFrom(row: unknown) { if (!row || typeof row !== 'object' || !('revision' in row)) throw new PersistenceError('revision'); const revision = Number(row.revision); if (!Number.isSafeInteger(revision) || revision < 0)
    throw new PersistenceError('revision'); return revision; }
function storedSettings(payload: string): State['settings'] { const value = parseStoredObject(payload, 'settings'); if (typeof value.name !== 'string' || typeof value.initialized !== 'boolean' || typeof value.inviteHash !== 'string' || !value.rules || typeof value.rules !== 'object')
    throw new PersistenceError('settings'); return value as State['settings']; }
function storedRecord<K extends TableName>(table: K, row: PayloadRow): State[K][number] { const value = parseStoredObject(row.payload, table); if (typeof value.id !== 'string' || !value.id || value.id !== row.id)
    throw new PersistenceError(table); return value as State[K][number]; }
function assignRecords<K extends TableName>(state: State, table: K, rows: PayloadRow[]) { state[table] = rows.map(row => storedRecord(table, row)) as State[K]; }
export async function load(): Promise<State> {
    const result = await raw().batch<Record<string, unknown>>([
        raw().prepare('SELECT COALESCE(MAX(revision),0) AS revision FROM commits'),
        raw().prepare('SELECT payload FROM settings WHERE id = ?').bind('club'),
        ...names.map(table => raw().prepare(`SELECT id,payload FROM ${table}`)),
    ]);
    const state = emptyState();
    state.revision = revisionFrom(result[0].results[0]);
    const settings = result[1].results[0];
    if (settings)
        state.settings = storedSettings(String(settings.payload));
    names.forEach((table, index) => assignRecords(state, table, result[index + 2].results as PayloadRow[]));
    const policy=profileRestrictionsFromConfig(env.PROFILE_GENDER_ONLY_PLAYER_IDS);
    if(policy)state.profileRestrictions=policy;
    return state;
}
export async function committed(key: string) { return !!(await raw().prepare('SELECT revision FROM commits WHERE key = ?').bind(key).first()); }
export async function save(s: State, key: string, previous: State, extra: D1PreparedStatement[] = [], beforeChanges: D1PreparedStatement[] = []) {
    const db = raw();
    const qs = [db.prepare('INSERT INTO commits(revision,key,at) VALUES(?,?,?)').bind(s.revision + 1, key, Date.now()), ...beforeChanges];
    // A unique revision is the optimistic transaction gate. A losing writer's entire D1 batch rolls back.
    for (const n of [...names].reverse()) {
        const current = new Set(s[n].map(r => r.id));
        for (const row of previous[n])
            if (!current.has(row.id))
                qs.push(db.prepare(`DELETE FROM ${n} WHERE id = ?`).bind(row.id));
    }
    if (JSON.stringify(s.settings) !== JSON.stringify(previous.settings))
        qs.push(db.prepare('INSERT INTO settings(id,payload) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').bind('club', JSON.stringify(s.settings)));
    for (const n of names) {
        const prior = new Map(previous[n].map(row => [row.id, JSON.stringify(row)]));
        for (const row of s[n]) {
            if (prior.get(row.id) === JSON.stringify(row))
                continue;
            const r = row as unknown as Record<string, unknown>;
            const columns = ['id'], values: unknown[] = [r.id];
            if (n === 'accounts') {
                columns.push('email', 'role', 'player_id');
                values.push(r.email, r.role, r.playerId);
            }
            else if (n === 'players') {
                columns.push('owner_id');
                values.push(r.ownerId);
            }
            else if (!['seasons', 'audits', 'events', 'ratingChanges', 'challenges', 'tagVotes', 'awardVotes', 'photos'].includes(n)) {
                columns.push('event_id');
                values.push(r.eventId);
                if (['registrations', 'attendance', 'payments'].includes(n)) {
                    columns.push('player_id');
                    values.push(r.playerId);
                }
                if (n === 'matches') {
                    columns.push('round_id');
                    values.push(r.roundId);
                }
                if (n === 'settlements') {
                    columns.push('version');
                    values.push(r.version);
                }
            }
            columns.push('payload');
            values.push(JSON.stringify(r));
            qs.push(db.prepare(`INSERT INTO ${n}(${columns.join(',')}) VALUES(${columns.map(() => '?').join(',')}) ON CONFLICT(id) DO UPDATE SET ${columns.slice(1).map(c => c + '=excluded.' + c).join(',')}`).bind(...values));
        }
    }
    await db.batch([...qs, ...extra]);
    s.revision++;
}
