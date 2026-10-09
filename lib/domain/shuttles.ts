import { parseDomainCommand } from './command-contract';
import { z } from 'zod';
import { authorizeEventAction } from './permissions';
import { fail, type Account, type State } from './types';
import { canVoteForShuttle } from './shuttle-voting';
export { shuttleParticipantIds, canVoteForShuttle, shuttleVoteCounts } from './shuttle-voting';
const id = z.string().min(1).max(100);
const schemas = {
    shuttleOption: z.object({ eventId: id, name: z.string().trim().min(1).max(100), note: z.string().trim().max(300).default('') }),
    shuttleRemove: z.object({ eventId: id, optionId: id }),
    shuttleConfirm: z.object({ eventId: id, optionId: id.nullable() }),
    shuttleVoting: z.object({ eventId: id, open: z.boolean() }),
    shuttleVote: z.object({ eventId: id, optionId: id.nullable() }),
};
export async function applyShuttles(s: State, a: Account, action: string, input: unknown, now: number) {
    const command = parseDomainCommand(schemas, action, input);
    if (!command)
        return false;
    const p = command.payload;
    if (action !== 'shuttleVote')
        authorizeEventAction(s, a, action, p);
    const e = s.events.find(e => e.id === p.eventId && e.deletedAt === undefined) ?? fail('活动不存在或已删除');
    if (['ended', 'cancelled'].includes(e.status))
        fail('活动已结束或取消，不能修改用球或投票');
    const plan = e.shuttlePlan ?? { options: [], votes: [], votingOpen: false };
    switch (command.action) {
        case 'shuttleVote': {
            const p = command.payload;
            if (!canVoteForShuttle(s, e, a, now))
                fail('403: 用球投票仅对已接龙成员开放，且须在活动开始前进行');
            if (p.optionId !== null && !plan.options.some(o => o.id === p.optionId))
                fail('候选球不存在，请刷新后重试');
            plan.votes = plan.votes.filter(v => v.voterId !== a.id);
            if (p.optionId !== null)
                plan.votes.push({ id: crypto.randomUUID(), voterId: a.id, playerId: a.playerId, optionId: p.optionId, at: now });
            break;
        }
        case 'shuttleOption': {
            const p = command.payload;
            if (plan.options.length >= 12)
                fail('每次活动最多添加12种候选球');
            if (plan.options.some(o => o.name.toLocaleLowerCase() === p.name.toLocaleLowerCase() && o.note === p.note))
                fail('这款候选球已添加');
            plan.options.push({ id: crypto.randomUUID(), name: p.name, note: p.note });
            break;
        }
        case 'shuttleRemove': {
            const p = command.payload;
            if (!plan.options.some(o => o.id === p.optionId))
                fail('候选球不存在');
            if (plan.selectedId === p.optionId)
                fail('请先更换或清除已确认的用球，再移除此候选球');
            plan.options = plan.options.filter(o => o.id !== p.optionId);
            plan.votes = plan.votes.filter(v => v.optionId !== p.optionId);
            if (!plan.options.length)
                plan.votingOpen = false;
            break;
        }
        case 'shuttleConfirm': {
            const p = command.payload;
            if (p.optionId !== null && !plan.options.some(o => o.id === p.optionId))
                fail('候选球不存在');
            plan.selectedId = p.optionId ?? undefined;
            plan.votingOpen = false;
            break;
        }
        case 'shuttleVoting': {
            const p = command.payload;
            if (p.open && (!plan.options.length || now >= e.start || !['open', 'locked'].includes(e.status)))
                fail('请在活动开始前、开放报名后添加候选球，再开启投票');
            plan.votingOpen = p.open;
            break;
        }
    }
    e.shuttlePlan = plan;
    s.audits.push({ id: crypto.randomUUID(), at: now, actor: a.id, action, reason: '活动用球与投票', changes: p });
    return true;
}
