import { parseDomainCommand } from './command-contract';
import { assertPlayerMutable } from './ownership';
import { z } from 'zod';
import { fail, type State, type Account } from './types';
import { finished, won, styleTags } from './social';
import { authorizeEventAction } from './permissions';
import { awardCandidateIds, canCastAwardVote, isAwardVotingOpen } from './activity-voting';
const id = z.string().min(1).max(100);
export const memberSocialActions = ['profileDetails', 'challenge', 'challengeRespond', 'tagVote', 'awardVote'];
const schemas = {
    profileDetails: z.object({ playerId: id, gender: z.enum(['male', 'female', 'other', 'undisclosed']).optional(), years: z.number().min(0).max(80), hand: z.enum(['right', 'left', 'both']), preference: z.enum(['doubles', 'singles', 'mixed', 'all']), style: z.string().trim().max(300), motto: z.string().trim().max(80).optional(), equipment: z.string().trim().max(500), level: z.enum(['beginner', 'intermediate', 'advanced']), racket: z.string().trim().max(120).optional(), strings: z.string().trim().max(120).optional(), tension: z.string().trim().max(80).optional(), tensionMin: z.number().min(1).max(80).nullable().optional(), tensionMax: z.number().min(1).max(80).nullable().optional() }).superRefine((p, c) => { const hasRange = p.tensionMin !== undefined || p.tensionMax !== undefined; if (!hasRange)
        return; if (p.tensionMin === null && p.tensionMax === null)
        return; if (typeof p.tensionMin !== 'number' || typeof p.tensionMax !== 'number')
        c.addIssue({ code: 'custom', path: ['tensionMin'], message: '磅数范围请同时填写最低和最高值，或同时留空' });
    else if (p.tensionMin > p.tensionMax)
        c.addIssue({ code: 'custom', path: ['tensionMax'], message: '最高磅数不能低于最低磅数' }); }),
    challenge: z.object({ targetId: id }), challengeRespond: z.object({ challengeId: id, status: z.enum(['accepted', 'declined', 'cancelled']) }), challengeMatch: z.object({ challengeId: id, matchId: id }),
    tagVote: z.object({ eventId: id, playerId: id, tag: z.string(), active: z.boolean() }), awardVote: z.object({ eventId: id, playerId: id, category: z.enum(['mvp', 'defense', 'net', 'effort']), active: z.boolean().optional() }),
    playSettings: z.object({ eventId: id, playMode: z.enum(['balanced', 'arena', 'koc']), identityMode: z.enum(['off', 'cp', 'mentor', 'carry']), arenaCourtId: z.string().max(100), handicap: z.boolean() }),
    handicap: z.object({ matchId: id, applied: z.boolean() }),
};
export async function applySocial(s: State, a: Account, action: string, input: unknown, now: number) {
    const command = parseDomainCommand(schemas, action, input);
    if (!command)
        return false;
    const p = command.payload;
    const eventAction = authorizeEventAction(s, a, action, p);
    if (!memberSocialActions.includes(action) && !eventAction && a.role !== 'admin')
        fail('403: 仅管理员可以执行此操作');
    const player = (id: string) => s.players.find(x => x.id === id && x.enabled) ?? fail('球友不存在或已停用');
    switch (command.action) {
        case 'profileDetails': {
            const p = command.payload;
            assertPlayerMutable(s, a, p.playerId);
            const pl = player(p.playerId);
            if (a.role !== 'admin' && p.playerId !== a.playerId)
                fail('403: 只能编辑自己的档案');
            const { playerId, motto, ...profile } = p;
            if (playerId !== pl.id) fail('球友档案不匹配');
            const next = { ...pl.profile, ...profile, ...(motto !== undefined ? { motto } : {}) };
            if (p.tensionMin !== undefined || p.tensionMax !== undefined)
                next.tension = p.tensionMin === null ? '' : `${p.tensionMin}–${p.tensionMax} 磅`;
            pl.profile = next;
            break;
        }
        case 'challenge': {
            const p = command.payload;
            if (p.targetId === a.playerId)
                fail('不能挑战自己');
            player(p.targetId);
            const loss = [...finished(s)].reverse().find(m => s.events.some(e => e.id === m.eventId && e.deletedAt === undefined) && [...m.a, ...m.b].includes(a.playerId) && !won(m, a.playerId) && m[m.a.includes(a.playerId) ? 'b' : 'a'].includes(p.targetId));
            if (!loss)
                fail('尚未在有效比赛中输给这位球友');
            if (s.challenges.some(c => c.challengerId === a.playerId && c.targetId === p.targetId && ['pending', 'accepted'].includes(c.status) && !c.matchId))
                fail('已有待处理的复仇挑战');
            s.challenges.push({ id: crypto.randomUUID(), challengerId: a.playerId, targetId: p.targetId, sourceMatchId: loss.id, created: now, status: 'pending', matchId: null });
            break;
        }
        case 'challengeRespond': {
            const p = command.payload;
            const c = s.challenges.find(c => c.id === p.challengeId) ?? fail('挑战不存在');
            if (s.matches.some(m => (m.id === c.sourceMatchId || m.id === c.matchId) && s.events.some(e => e.id === m.eventId && e.deletedAt !== undefined)))
                fail('挑战关联的活动已删除，请先恢复活动');
            if (c.matchId)
                fail('挑战已关联比赛，请由管理员调整比赛');
            if (p.status === 'cancelled') {
                if (c.challengerId !== a.playerId && a.role !== 'admin')
                    fail('403: 只能撤回自己的挑战');
            }
            else if (player(c.targetId).ownerId !== a.id && a.role !== 'admin')
                fail('403: 只有被挑战者可以回应');
            if (!['pending', 'accepted'].includes(c.status))
                fail('挑战已经处理');
            c.status = p.status;
            break;
        }
        case 'challengeMatch': {
            const p = command.payload;
            const c = s.challenges.find(c => c.id === p.challengeId) ?? fail('挑战不存在'), m = s.matches.find(m => m.id === p.matchId) ?? fail('比赛不存在');
            if (c.status !== 'accepted')
                fail('双方尚未接受挑战');
            if (!['draft', 'published'].includes(m.status))
                fail('只能关联未开始的比赛');
            if (!((m.a.includes(c.challengerId) && m.b.includes(c.targetId)) || (m.b.includes(c.challengerId) && m.a.includes(c.targetId))))
                fail('挑战双方须在比赛两侧');
            if (c.matchId && c.matchId !== m.id)
                fail('挑战已安排到另一场比赛');
            c.matchId = m.id;
            break;
        }
        case 'tagVote': {
            const p = command.payload;
            const e = s.events.find(e => e.id === p.eventId && e.deletedAt === undefined) ?? fail('活动不存在或已删除');
            if (e.status === 'cancelled')
                fail('活动已取消，不能投票');
            if (!isAwardVotingOpen(s, e, now))
                fail('活动尚未打完，请在活动结束后评选');
            if (!canCastAwardVote(s, e, a, now))
                fail('403: 仅本活动参与者、活动创建者和管理员可以投票');
            player(p.playerId);
            if (!awardCandidateIds(s, e.id, now).includes(p.playerId))
                fail('候选球友须参与本次活动');
            if (!styleTags.includes(p.tag))
                fail('打法标签不存在');
            const mine = (v: State['tagVotes'][number]) => v.eventId === e.id && v.voterId === a.id && v.playerId === p.playerId && v.tag === p.tag;
            const voteId = s.tagVotes.find(mine)?.id ?? crypto.randomUUID();
            s.tagVotes = s.tagVotes.filter(v => !mine(v));
            if (p.active)
                s.tagVotes.push({ id: voteId, eventId: e.id, voterId: a.id, playerId: p.playerId, tag: p.tag, at: now });
            break;
        }
        case 'awardVote': {
            const p = command.payload;
            const e = s.events.find(e => e.id === p.eventId && e.deletedAt === undefined) ?? fail('活动不存在或已删除');
            if (e.status === 'cancelled')
                fail('活动已取消，不能投票');
            if (!isAwardVotingOpen(s, e, now))
                fail('活动尚未打完，请在活动结束后评选');
            if (!canCastAwardVote(s, e, a, now))
                fail('403: 仅本活动正式报名或实际参加的球友、活动创建者和管理员可以投票');
            const mine = (v: State['awardVotes'][number]) => v.eventId === e.id && v.voterId === a.id && v.category === p.category;
            const previous = s.awardVotes.find(mine);
            if (p.active === false) {
                if (previous && previous.playerId !== p.playerId)
                    fail('409: 选票已更新，请刷新后再撤回');
                s.awardVotes = s.awardVotes.filter(v => !mine(v));
            }
            else {
                if (!awardCandidateIds(s, e.id, now).includes(p.playerId))
                    fail('候选球友须已正式报名或实际参加本次活动，且档案启用');
                if (p.playerId === a.playerId)
                    fail('请把这一票投给其他球友');
                const voteId = e.id + ':' + a.id + ':' + p.category;
                s.awardVotes = s.awardVotes.filter(v => !mine(v));
                s.awardVotes.push({ id: voteId, eventId: e.id, voterId: a.id, playerId: p.playerId, category: p.category, at: now });
            }
            break;
        }
        case 'playSettings': {
            const p = command.payload;
            const e = s.events.find(e => e.id === p.eventId) ?? fail('活动不存在');
            if (p.playMode === 'arena' && e.pointsChoice?.selectedMode === 'fixed')
                fail('擂台按胜负换人，请先确认轮换搭档，再切换擂台玩法');
            if (s.matches.some(m => m.eventId === e.id && ['published', 'playing'].includes(m.status)))
                fail('请先结束正在比赛的轮次或取消未开始轮次');
            if (p.playMode === 'arena' && !s.bookings.some(b => b.id === p.arenaCourtId && b.eventId === e.id))
                fail('请选择一块有效的擂台场地');
            e.playMode = p.playMode;
            e.identityMode = p.identityMode;
            e.arenaCourtId = p.arenaCourtId || undefined;
            e.handicap = p.handicap;
            s.rounds.filter(r => r.eventId === e.id && r.status === 'draft').forEach(r => { r.status = 'cancelled'; s.matches.filter(m => m.roundId === r.id).forEach(m => m.status = 'cancelled'); });
            break;
        }
        case 'handicap': {
            const p = command.payload;
            const m = s.matches.find(m => m.id === p.matchId) ?? fail('比赛不存在');
            if (!['draft', 'published'].includes(m.status))
                fail('让分须在开赛前确定');
            if (!m.handicap)
                fail('此场暂无让分建议');
            m.handicap.applied = p.applied;
            m.monthly = true;
            m.elo = !p.applied;
            break;
        }
    }
    s.audits.push({ id: crypto.randomUUID(), at: now, actor: a.id, action, reason: '社群功能操作', changes: p });
    return true;
}
