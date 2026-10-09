# Lifetime achievements

The collection contains eight original imagegen badge themes, each with five attainable stages: Bronze, Silver, Gold, Platinum and Diamond. Members can inspect their collection under the account tab and on player profiles. Cards show the current rank, the next concrete goal, the play-date requirement and remaining progress. A details panel previews all five rank appearances and factual achievement dates. A same-account refresh announces rank increases only; initial loads, old response schemas, identity switches and rank decreases announce nothing.

Every stage needs both its metric target and a number of distinct lifetime Madrid play dates. The thresholds are `achievementTargets` and `achievementParticipationDays` in `lib/achievement-catalog.ts`.

| Badge ID | Rarity | Metric | Metric target, Bronze / Silver / Gold / Platinum / Diamond | Play dates, Bronze / Silver / Gold / Platinum / Diamond |
|---|---|---|---|---|
| first-flight (启程一羽) | 初阶 | Completed matches | 1 / 20 / 60 / 150 / 300 | 1 / 4 / 10 / 20 / 40 |
| first-victory (初露锋芒) | 初阶 | Wins | 1 / 10 / 35 / 100 / 220 | 1 / 4 / 10 / 20 / 40 |
| ten-matches (四方论剑) | 进阶 | Distinct defeated opponents | 4 / 6 / 10 / 15 / 20 | 2 / 5 / 12 / 24 / 40 |
| ten-victories (黄金搭档) | 进阶 | Highest cumulative wins with one teammate | 3 / 8 / 25 / 60 / 120 | 2 / 5 / 12 / 24 / 40 |
| five-partners (五路同修) | 进阶 | Distinct teammates | 5 / 8 / 12 / 16 / 20 | 2 / 5 / 12 / 24 / 40 |
| three-game-victory (三局决胜) | 进阶 | Best-of-three wins that reach three games | 1 / 5 / 12 / 25 / 50 | 2 / 5 / 12 / 24 / 40 |
| fifty-matches (持之以恒) | 珍稀 | Distinct Madrid calendar dates with completed matches | 3 / 6 / 16 / 35 / 60 | 3 / 6 / 14 / 28 / 48 |
| three-streak (三连之势) | 珍稀 | Lifetime best personal winning streak | 3 / 6 / 10 / 15 / 21 | 3 / 6 / 14 / 28 / 48 |

The club plays about once a week. A first play date can light at most the two 初阶 badges: one for the first completed match and one for the first win, however many games are played or won that evening. 进阶 badges need a second play date and 珍稀 badges a third. Silver needs four to six play dates (about a month), Gold ten to fourteen (two to three months), Platinum twenty to twenty-eight (five to six months) and Diamond forty to forty-eight (most of a year). One day with many matches or multiple activities still counts once. Missing weeks impose no penalty, and dates need not be consecutive. At about eight games a week, play dates are usually the limit for match counts, while win, partner, opponent and streak targets can take longer. These are examples, not promised timing.

Earlier versions unlocked far more on a first evening. In a simulation of eight doubles games with about half won, the original 1 / 3 / 5 / 10 / 20 style targets lit about seven themes and thirteen stages, including Gold for completed matches. The first play-date version (Bronze needed one date for every theme) still lit about seven Bronze badges. The current table lights two.

All eight themes have distinct metrics. Repeated cumulative-match and cumulative-win themes were replaced with opponent breadth, regular play on different dates, and sustained chemistry with one partner. Their legacy IDs and artwork paths stay stable, but their names, rules, progress and dates are derived from the current criteria. Existing records recalculate every theme under the current criteria; original matches and results are preserved.

All targets are lifetime cumulative goals. Higher stages require more completed facts, never payment or random rewards. Rank 0 is locked; rank 5 is maximum and has no next goal. Each threshold stores the first factual crossing time when both conditions are supported in the derived response, so historical games backfill all supported ranks immediately. The collection reports both themes unlocked out of eight and stages earned out of forty. A loss does not remove a lifetime best-streak milestone; correcting or voiding its underlying matches can.

Regular play counts the Madrid calendar date of the match's end. Multiple matches or activities ending on the same date count once, including across daylight-saving transitions. Wins are unnecessary for that metric. Opponent breadth only adds opposing real player IDs from wins and counts each player once. Partner chemistry maintains a separate win total per real teammate and takes the maximum, rather than adding different teammates together. Its details show the teammate currently holding that record. Ties keep the first record holder in deterministic chronological order. Losing does not subtract wins; score corrections and voiding recalculate all three metrics.

## Facts, permissions and corrections

Achievements are derived on the server from lifetime completed results, in stable end-time/ID order. Each distinct match counts once; a player's streak changes only for their own valid completed matches. Teammates count as partners, opponents do not. Friendly completed games can count, while cancelled, forfeited, pending, incomplete, malformed or future results cannot.

The projection applies the viewer's event visibility before deriving achievements. A member cannot infer private draft results from new badges. Finished historical facts survive an activity's soft deletion; a corrected loss or voided match recalculates the collection. These are factual achievements, not irrevocable awards: historical corrections can remove a badge or alter its unlock date.

No database migration or new award-write endpoint is required. The derived response exposes matchDays, and cards, stage counts, progress bars, filter states and roadmap dates all use the same dual requirements. Legacy inflated levels are not grandfathered: history is recalculated, so existing members can show fewer badges or lower ranks after a threshold change, while score, ranking points, realm ratings and matchmaking Elo are unchanged. The client never stores earned levels; an open app that refreshes into lower levels shows no message, and a later genuine increase announces the new level. Clients cannot submit unlocks. Achievements do not add ranking points, Elo, financial charges or permissions. Conditional-read metadata expires at future factual completion boundaries so a newly due result is not hidden by an unchanged revision.


## Assets and performance

Artwork was generated using the built-in imagegen tool. The transparent 256px badge themes total about 175 KiB. Five shared 384px transparent rank frames add about 166 KiB and combine with every theme, providing forty distinct rank/theme appearances without forty redundant images. Bronze is a simple copper rim; silver adds leaves and a pearl; gold adds feather wings and cloud engraving; platinum adds layered wings and teal filigree; diamond adds crystal wings, a crown and jewel. The original theme stays visible inside each hollow frame. Personal collection artwork loads eagerly; other player collections load artwork lazily. Original PNGs remain in ignored local work directories. See [asset prompts and paths](ACHIEVEMENT_ASSETS.md) and [rank frame prompts](ACHIEVEMENT_RANK_ASSETS.md).

## Verification

Regression tests cover milestones, factual unlock dates, personal streak order, distinct partners and defeated opponents, Madrid calendar dates, individual partner records, duplicate records, best-of-three wins, invalid/future games, score corrections, voiding, archived activities, private drafts and conditional-read boundaries. A catalog guard prevents two themes from using the same metric. Threshold tests check that only the two 初阶 themes need a single play date, that a perfect eight-game evening lights exactly two badges, and that every later stage needs both more of its metric and more play dates. All eight referenced badge files are validated as actual 256px WebP assets with a combined size below 256 KiB.
