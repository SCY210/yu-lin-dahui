# Elo-balanced doubles and profiles

Branch: `feature/balanced-match-grouping`.

Elo remains `doubles-elo-v1`: validated, completed Elo-enabled matches update
the existing rating from the administrator's initial estimate. Ranking points,
years played do not influence Elo or grouping; a declared gender is used only by the rule in `docs/GENDER_BALANCE.md`. The former
self-declared profile level has been removed and was never an input.
New players keep the neutral default; the existing provisional flag lasts for
the first ten rated matches. No historical ratings are migrated or recomputed
solely because of this change.

Fair-turn debt, availability, locked matches, arena holders and venue boundaries
still determine eligibility and who plays. Among eligible selections the
optimizer compares gender mismatches first, then the worst average-Elo gap above
a 40-point tolerance with a bounded 80-point cost for an exact rematch and
another 80-point cost for reusing the same four players. It then compares total
gap, historical cohort/rematch counts and partner/opponent variety. A 40-point gap means about 56/44
expected win probability under the existing Elo model; this is a preference,
not a guarantee. Each ordinary court checks all three pairings. A seeded local
search also exchanges players between compatible courts; it does not guarantee
a global optimum. Fixed partners stay together and use the same balance
priority when matching opposing teams. With unequal players, repeating a
partner can be necessary for a fair contest, including individual rotation.

Live rotating doubles also add a bounded partner-repetition cost to the adjusted
worst gap: 24 points for each immediate repeat plus 4 per historical pair use
(the frequency part is capped at 16), with an overall cap of 40. Unlike exact
rematch cost, this applies when the same pair faces different opponents. The
separate frequency cap keeps recency meaningful during long sessions. It is a
soft balance/variety tradeoff, never an eligibility ban; other scheduling modes
pass zero for this extra cost.

History is indexed once per scheduling operation, including published plans
when planning future rounds. Cancelled drafts and no-show forfeits do not count
as played encounters. Team order, side reversal and court changes do not hide
a repeat. Within otherwise comparable choices, meeting someone new gets priority
whether that person is a partner or an opponent.

Live scheduling also searches equally entitled waiting players instead of always
taking the same signup-order cohort. Bench priority remains the starting queue;
breaking a repeated cohort or introducing a new contact can exchange one waiting
position with a willing just-finished player (one complete team for fixed pairs).
Only when the free pool consists of exactly two court-sized groups may that
substitute be one appearance ahead. Such exchanges require the resulting spread
to stay within two appearances, including games still in progress. Rest requests,
busy players, venue eligibility and fixed partners remain hard constraints.
This prevents the permanent three-group cycle with 12 players on two courts.
Limited attendance, fixed partners, strength gaps and rest preferences can still
make some repetition unavoidable; the search does not promise every possible
encounter in a fixed number of games. Already published lineups are preserved;
the new policy applies when generating new matches.

The optional profile `gender` accepts `male`, `female`, `other`, `undisclosed`.
Old records show “不愿透露” without a migration; old clients omitting the field
preserve a saved choice. The choice is visible to authenticated club members
alongside the other profile fields. Existing ownership/admin editing rules apply.

Match and resting-player names/avatars open the existing full profile and
preserve navigation back to the activity. Draft position swaps use a separate
button; profile navigation remains available for published, playing and finished
matches and fixed partners.

Validation: `tests/match-grouping.test.ts` covers balance versus repetition,
multiple courts, deterministic variety, fixed teams, profile persistence and
permissions, and independence of Elo/grouping from profile declarations.
`tests/live-play.test.ts` additionally exercises a long 12-player/two-court run
with full roster exposure, bounded appearances and no overlapping players;
`tests/match-history.test.ts` checks canonical identities and excluded history.

Verified on Node 24: all 415 unit tests and the existing API checks pass;
TypeScript and the production build pass. Browser checks cover opening a profile
from a draft match, all four gender options, saving a choice, and returning to
the same activity/round. Lint passes for the new components and grouping domain
files; repository-wide lint already reports existing `any` errors and generated
files from ignored local test folders.

## At most three rounds in a row

A player who played each of the latest three rounds of an activity (`tiredPlayers`, `maxConsecutiveRounds` in `lib/domain/grouping.ts`) is chosen last for the next round in round, planned and gap-filling generation, for doubles, singles and fixed teams. So they rest whenever somebody else can take the place. Courts are never left short only for this rule: when the remaining players cannot fill every court, tired players still play. The rule can therefore only be met when at least a quarter of the players rest each round; with 10 players on two courts some must play a fourth round.

Live doubles send everyone off after each game and take the next four from a queue, longest wait first, without breaking up fixed pairs or letting one game come back as a block. Scarcity falls back to any eligible available players, including the same four; legacy win-limit rests no longer block selection. Planned rounds follow the same rules as live rotation where they apply. A court may not take three or more players straight from one earlier game, which costs like a repeated foursome. Repeated partners use live rotation's partner cost. In simulations of 2-4 courts with 10-24 players, reunited blocks and immediate partner repeats fell from up to 11% and 9% of games to at most 1%, with games played, waits and strength balance unchanged. See [Live court rotation](LIVE_PLAY.md).

## Mixing everyone on few courts

The fair-turn order (games owed, then rounds waited) often leaves ties, and ties used to fall back to list order. With one court and 8 players that formed two fixed groups of four that only played each other. The search now also swaps a resting player in for a selected one when the two are interchangeable for fair turns (`sameTurn` in `lib/domain/grouping.ts`):

- the same number of games owed and the same three-round rest;
- waiting at most one round apart;
- the incoming player's run of rounds in a row stays at two or less, unless the replaced player's run is as long.

A swap is kept only when it improves the pairing cost, which penalises repeated groups of four, partners and opponents. Game counts stay equal; occasionally someone waits two rounds while another plays two in a row. Among equal turns, the player with the longer run rests first. Singles use the same rule. `tests/court-mixing.test.ts` checks one court with 8 and 12 players, singles with 4 players, and the live three-game limit.

## Nobody on two courts at once

Within one round nobody appears on two courts, and nobody plays two games at the same time:

- A late player's replacement is never taken from another court of the same round, even when that court has not started yet.
- A swap into a game already on court refuses a player who is playing on another court.

`tests/round-integrity.test.ts` checks both cases and runs random planned-schedule operations against the invariant.

## Courts that do not wait for each other

On two or more courts, a planned round is laid out so that each court can start its next game as soon as its own game ends. A court whose next group includes a player still finishing on another court must wait for that court too; the search counts such courts (`courtWaits`, `COURT_WAIT_COST` in `lib/domain/match-balance.ts`) and prefers line-ups where the players of one court's game move on together and the other court's players stay with the other court. A block of three from one game still costs more (`BLOCK_COST`), and so does an immediate partner repeat on more than one court (`RECENT_PARTNER_COST`), so avoiding a wait never re-pairs partners or reunites a block. The previous round is the latest planned, non-cancelled round before the one being planned.

Simulations of 16 rounds (`planPoints`, four hours of 15-minute rounds, random strengths, 8 seeds each) give these shares of rounds where every court waits for another court, before and after:

| Courts / players | Before | After |
| --- | --- | --- |
| 2 / 12 | 58% | 6% |
| 2 / 16 | 37% | 0% |
| 3 / 16 | 90% | 8% |
| 3 / 18 | 67% | 0% |
| 4 / 20 | 96% | 13% |
| 4 / 24 | 78% | 0% |

Immediate partner repeats and reunited blocks stay at 0%, and strength balance is unchanged. Planned singles use the same court-wait cost; on three and four courts this cut idle court time by 15-35%.

In a minute-by-minute simulation through the real commands, with games lasting 9-21 minutes, court time left idle while four free players waited (they were due on a court still playing) fell, for example, from 99 to 59 minutes on three courts with 18 players and from 130 to 42 minutes on four courts with 28, with up to six more games in four hours. With only one player resting per court and round (13 on three courts, 17-20 on four), planned rounds still leave courts idle for 2-3 court-hours a night, because every next game needs players from courts still playing. Live rotation fills courts as they free and played 20-25% more games in those cases, but its sides are far less even in strength, so the planned schedule stays the recommended mode ([Recommended mode](SCHEDULING_MODES.md#recommended-mode)).

When an attendance or court phase ends, its unstarted planned games are skipped (`pointsPhaseAdvance`). The later rounds were planned as if those games had been played, so in the same step every later round that has not started is planned again from the games actually played (`pointsReplan`, `lib/domain/planned-replan.ts`): same times, seeds and courts, new lineups, and a court keeps its game ID. Rounds an organiser swapped by hand, rounds with a started or scored game, drafts and overtime rounds keep their lineups; if one round cannot be planned, nothing changes. This takes up to about a second on four courts, once per phase change, which Workers Paid allows (docs/PERFORMANCE_BUDGET.md). In the simulation with late arrivals, early departures and a court ending early, the largest gap between a player's games and their share fell from 2.0-4.0 to 1.0-2.2 games, and the longest wait usually fell too (for example 100 to 71 minutes on two courts with 14 players). With only two players resting (10 players on two courts, 14 on three) most rounds still have one dependent court: almost every player plays every round, so the players of one game cannot all stay on their court.

## Unplayed planned games are removed at the end

When an activity has ended, planned games of published rounds that never started and have no score are deleted, and a round left empty goes with them (`deleteUnplayedPlanned` in `lib/domain/planned-cleanup.ts`, run by the read-time maintenance in `lib/club-maintenance.ts` and recorded in the audit log as `deleteUnplayedPlanned`). Games that started stay, so their score can still be entered. Overtime rounds and live rounds are left alone, and tournaments are not affected. `tests/planned-cleanup.test.ts` checks it.

## 实力碾压、同一批人和萌新的先后（2026-11-22）

群主要求：大家打的局数差不多，尽量和大部分人都打过、不总是同一批人，不出现实力碾压；高手对高手、萌新对萌新只在其他条件满足后才考虑。检查 11 月 21 日的实时排场（18 人、最多三片场、60 局）发现：

- 有人看到的「元婴加化神对金丹加元婴」（平均分差 172）不是系统排的：系统排的是两位元婴对金丹加化神，分差 25；是一位球友在活动结束五小时后点了开始组队，又把自己换到另一边。现在只有宗主、副宗主、长老和活动创建者能交换上场人员，活动结束后也只有他们能开加时局（[实时排场](LIVE_PLAY.md)）。
- 60 局里有 11 局平均分差超过 60、5 局超过 100，多数有最弱的两位球友：实时排场按队列定下四人后只能在四人里分队。
- 有两人在 15 局里同场 8 局：原来只罚完全相同的四人和一局三人回来，不罚两个人总在一起。

排场用的实力分也和显示的修为统一成一个分数：此前只回放双打，现在双打、单打和群主的修为调整都计入；境界的降级缓冲只影响显示的境界名字，排场按分数本身（[修为与境界](REALM_PROGRESSION.md)）。

于是比较顺序改为（`compareBalance`、`compareLiveDoublesPriority`，`lib/domain/match-balance.ts`）：

1. 谁上场仍先按轮次公平决定（局数差不多）。
2. 性别保护。
3. 实力碾压：两队平均修为分差超过 80 分（`CRUSH_GAP`）的部分，所有场地相加，越少越好；只要有不碾压的分法就不用碾压的。预排还会跨场换人来避免碾压；实时排场在公平范围内换不掉时，可以让步一局（[实时排场](LIVE_PLAY.md)）。临时搭档概率在 1%–99% 时，抽签也不能造成碾压（预排和实时排场都一样）；设为 0% 或 100% 的规则按群主要求一定执行（[临时搭档概率](PAIRING_ODDS.md)）。
4. 重打、重复四人组、一局三人回来、场地等待、重复搭档、超出 40 分的分差，以及同一批人：同场的每两人在本活动已经同场过几局，每局记 8 分（`TOGETHER_COST`，`matchHistory().together`）。
5. 总分差、搭档和对手多样性。
6. 最后才是萌新避让（[萌新避让](NEWBIE_GROUPING.md)）。

按 11 月 21 日的名单和实力做的模拟（虚构球友，三片场其中一片只有两小时，三位晚到，16 个种子，每次 4 小时，同一套随机数比较改前改后）：

| 方式 | 最大平均分差 | 超过 80 分的局 | 两人最多同场局数 | 每人平均见过的人 |
| --- | --- | --- | --- | --- |
| 实时，改前 | 103 | 1 | 8 | 12.8 |
| 实时，改后 | 62 | 0 | 6 | 12.7 |
| 预排，改前 | 75 | 0 | 8 | 12.8 |
| 预排，改后 | 77 | 0 | 5 | 13.8 |

同日又加了实时排场的连打上限（连打两局后，场下有人能顶上就先休息一局，[实时排场](LIVE_PLAY.md)）：同一模拟里最长连打从 6 局降到 4 局，连打三局以上从 89 次降到 25 次，代价是两人最多同场局数从 6 升到 8。剩下的长连打出现在场下人数凑不满一片场的时候。打散「一局三人回来」时也改为先看性别保护和不碾压。

局数差距不变。模拟里的分差比真实那晚小：真实那晚还有球友手动换人，模拟没有。预排单打的分差是两个人之间的差，避免碾压后要等别的场地打完的场次从 55% 增加到 76%（`tests/planned-rotation.test.ts`）；两片场十人的预排，为了避免碾压，64 局里最多有一局会带回一局三人。

测试：`tests/fair-scheduling.test.ts`（比较顺序、碾压线、同场次数）、`tests/live-overtime.test.ts` 和 `tests/live-play-api.mjs`（换人与加时权限）。

