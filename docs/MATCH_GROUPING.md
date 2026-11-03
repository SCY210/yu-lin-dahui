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

In a minute-by-minute simulation through the real commands, with games lasting 9-21 minutes, court time left idle while four free players waited (they were due on a court still playing) fell, for example, from 99 to 59 minutes on three courts with 18 players and from 130 to 42 minutes on four courts with 28, with up to six more games in four hours. With only one player resting per court and round (13 on three courts, 17-20 on four), planned rounds still leave courts idle for 2-3 court-hours a night, because every next game needs players from courts still playing. Live rotation fills courts as they free and played 20-25% more games in those cases.

When an attendance or court phase ends, its unstarted planned games are skipped (`pointsPhaseAdvance`). Their players lose that game; later rounds, planned in advance, do not give it back. In the simulation with late arrivals, early departures and a court ending early, this left individual players up to about 1.5 games below their share, while the average stayed fair. With only two players resting (10 players on two courts, 14 on three) most rounds still have one dependent court: almost every player plays every round, so the players of one game cannot all stay on their court.

## Unplayed planned games are removed at the end

When an activity has ended, planned games of published rounds that never started and have no score are deleted, and a round left empty goes with them (`deleteUnplayedPlanned` in `lib/domain/planned-cleanup.ts`, run by the read-time maintenance in `lib/club-maintenance.ts` and recorded in the audit log as `deleteUnplayedPlanned`). Games that started stay, so their score can still be entered. Overtime rounds and live rounds are left alone, and tournaments are not affected. `tests/planned-cleanup.test.ts` checks it.
