import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkTexts, chineseProblems } from '../scripts/check-chinese-text.mjs';

test('Chinese PR titles, descriptions and commit messages pass with code, paths and links kept as they are', () => {
  for (const text of [
    '朋友水平按修为境界命名，新增萌新一档',
    '修改 `lib/domain/guests.ts` 里的 guestLevels，跑过 `npm run verify`：1156 项测试通过。',
    '服务端改动符合 Workers Paid 预算，见 docs/PERFORMANCE_BUDGET.md 和 https://github.com/SCY210/yu-lin-dahui/pull/143 。',
    '把 bookingClaim 的 release 参数接到 setRangeAdvancer，CI 和 PR #141 不冲突。\n\n```\nnode scripts/check-shared-source.mjs --check\nThis block may hold any output.\n```',
    '修复约场认领\n\nCo-authored-by: Some Person <someone@example.com>',
    '本地可运行 npm run check:chinese-text 检查提交。',
    '',
  ]) assert.deepEqual(chineseProblems(text), [], text);
});

test('English sentences, text without Chinese and other languages are rejected', () => {
  assert.match(chineseProblems('Reduce profile image transfer size and authorization latency').join(), /英文句子/);
  assert.match(chineseProblems('Fix lint').join(), /没有中文/);
  assert.match(chineseProblems('Call the long-term rating 修为').join(), /英文句子/, 'Chinese terms do not excuse an English sentence');
  assert.match(chineseProblems('修复约场认领。正しく動くようにしました').join(), /中文以外的文字/);
  assert.match(chineseProblems('수정했습니다').join(), /中文以外的文字/);
  assert.match(chineseProblems('修复 исправлено').join(), /中文以外的文字/);
});

test('each failure names the PR title, description or commit it came from', () => {
  const problems = checkTexts([
    { label: 'PR 标题', text: '新增萌新一档' },
    { label: 'PR 描述', text: 'This change adds a new level for beginners.' },
    { label: '提交 abc1234', text: 'Add beginner level' },
  ]);
  assert.equal(problems.filter(p => p.startsWith('PR 标题')).length, 0);
  assert.ok(problems.some(p => p.startsWith('PR 描述：')));
  assert.ok(problems.some(p => p.startsWith('提交 abc1234：')));
});
