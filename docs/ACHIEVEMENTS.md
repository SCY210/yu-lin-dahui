# Lifetime achievements

The collection contains eight original imagegen badge themes, each with five attainable stages: Bronze, Silver, Gold, Platinum and Diamond. Members can inspect their collection under the account tab and on player profiles. Cards show the current rank, the next concrete goal and remaining progress. A details panel previews all five rank appearances and factual achievement dates. A same-account refresh announces rank increases; initial loads, old response schemas and identity switches do not announce historical awards.

| Badge ID | Metric | Bronze / Silver / Gold / Platinum / Diamond |
|---|---|---|
| first-flight | Completed matches | 1 / 20 / 60 / 150 / 300 |
| first-victory | Wins | 1 / 10 / 35 / 100 / 220 |
| ten-matches (四方论剑) | Distinct defeated opponents | 2 / 5 / 9 / 14 / 20 |
| fifty-matches (持之以恒) | Distinct Madrid calendar dates with completed matches | 1 / 6 / 16 / 35 / 60 |
| ten-victories (黄金搭档) | Highest cumulative wins with one teammate | 1 / 8 / 25 / 60 / 120 |
| three-streak | Lifetime best personal winning streak | 3 / 6 / 10 / 15 / 21 |
| five-partners | Distinct teammates | 5 / 8 / 12 / 16 / 20 |
| three-game-victory | Best-of-three wins that reach three games | 1 / 5 / 12 / 25 / 50 |

All eight themes now have distinct metrics. Repeated cumulative-match and cumulative-win themes have been replaced with opponent breadth, regular play on different dates, and sustained chemistry with one partner. Their legacy IDs and artwork paths stay stable, but their names, rules, progress and dates are derived from the new criteria. All five stages now use the longer-term targets above. Existing records recalculate every theme under the current criteria; original matches and results are preserved.

Every stage also requires distinct lifetime Madrid play dates: Bronze 1, Silver 3, Gold 8, Platinum 20, Diamond 40. Both its metric target and participation target must be reached. One day with many matches or multiple activities still counts once. A normal eight-game, two-hour session can only earn Bronze; Silver needs at least three actual play dates and Gold at least eight. Missing weeks impose no penalty, and dates need not be consecutive. With six games per week, 20 completed matches take about four sessions and 60 take about ten; these are examples, not promised timing.

All targets are lifetime cumulative goals. Higher stages require more completed facts, never payment or random rewards. Rank 0 is locked; rank 5 is maximum and has no next goal. Each threshold stores the first factual crossing time when both conditions are supported in the derived response, so historical games backfill all supported ranks immediately. The collection reports both themes unlocked out of eight and stages earned out of forty. A loss does not remove a lifetime best-streak milestone; correcting or voiding its underlying matches can.

Regular play counts the Madrid calendar date of the match's end. Multiple matches or activities ending on the same date count once, including across daylight-saving transitions. Wins are unnecessary for that metric. Opponent breadth only adds opposing real player IDs from wins and counts each player once. Partner chemistry maintains a separate win total per real teammate and takes the maximum, rather than adding different teammates together. Its details show the teammate currently holding that record. Ties keep the first record holder in deterministic chronological order. Losing does not subtract wins; score corrections and voiding recalculate all three metrics.

## Facts, permissions and corrections

Achievements are derived on the server from lifetime completed results, in stable end-time/ID order. Each distinct match counts once; a player's streak changes only for their own valid completed matches. Teammates count as partners, opponents do not. Friendly completed games can count, while cancelled, forfeited, pending, incomplete, malformed or future results cannot.

The projection applies the viewer's event visibility before deriving achievements. A member cannot infer private draft results from new badges. Finished historical facts survive an activity's soft deletion; a corrected loss or voided match recalculates the collection. These are factual achievements, not irrevocable awards: historical corrections can remove a badge or alter its unlock date.

No database migration or new award-write endpoint is required. The derived response exposes matchDays, and cards, stage counts, progress bars, filter states and roadmap dates all use the same dual requirements. Legacy inflated levels are not grandfathered: history is recalculated, while score, ranking points, cultivation and Elo are unchanged. Clients cannot submit unlocks. Achievements do not add ranking points, Elo, financial charges or permissions. Conditional-read metadata expires at future factual completion boundaries so a newly due result is not hidden by an unchanged revision.

## Assets and performance

Artwork was generated using the built-in imagegen tool. The transparent 256px badge themes total about 175 KiB. Five shared 384px transparent rank frames add about 166 KiB and combine with every theme, providing forty distinct rank/theme appearances without forty redundant images. Bronze is a simple copper rim; silver adds leaves and a pearl; gold adds feather wings and cloud engraving; platinum adds layered wings and teal filigree; diamond adds crystal wings, a crown and jewel. The original theme stays visible inside each hollow frame. All artwork loads lazily. Original PNGs remain in ignored local work directories. See [asset prompts and paths](ACHIEVEMENT_ASSETS.md) and [rank frame prompts](ACHIEVEMENT_RANK_ASSETS.md).

## Verification

Regression tests cover milestones, factual unlock dates, personal streak order, distinct partners and defeated opponents, Madrid calendar dates, individual partner records, duplicate records, best-of-three wins, invalid/future games, score corrections, voiding, archived activities, private drafts and conditional-read boundaries. A catalog guard prevents two themes from using the same metric. All eight referenced badge files are validated as actual 256px WebP assets with a combined size below 256 KiB.
