# Lifetime achievements

The collection contains eight original imagegen badge themes, each with five attainable stages: Bronze, Silver, Gold, Platinum and Diamond. Members can inspect their collection under the account tab and on player profiles. Cards show the current rank, the next concrete goal and remaining progress. A details panel previews all five rank appearances and factual achievement dates. A same-account refresh announces rank increases; initial loads, old response schemas and identity switches do not announce historical awards.

| Badge ID | Metric | Bronze / Silver / Gold / Platinum / Diamond |
|---|---|---|
| first-flight | Completed matches | 1 / 3 / 5 / 10 / 20 |
| first-victory | Wins | 1 / 3 / 5 / 10 / 20 |
| ten-matches (四方论剑) | Distinct defeated opponents | 2 / 4 / 6 / 8 / 12 |
| fifty-matches (持之以恒) | Distinct Madrid calendar dates with completed matches | 1 / 3 / 7 / 15 / 30 |
| ten-victories (黄金搭档) | Highest cumulative wins with one teammate | 1 / 3 / 5 / 10 / 20 |
| three-streak | Lifetime best personal winning streak | 3 / 4 / 5 / 6 / 8 |
| five-partners | Distinct teammates | 5 / 6 / 8 / 10 / 12 |
| three-game-victory | Best-of-three wins that reach three games | 1 / 3 / 5 / 10 / 20 |

All eight themes now have distinct metrics. Repeated cumulative-match and cumulative-win themes have been replaced with opponent breadth, regular play on different dates, and sustained chemistry with one partner. Their legacy IDs and artwork paths stay stable, but their names, rules, progress and dates are derived from the new criteria. Existing records immediately recalculate the changed themes; the other five themes retain their rules and targets.

All targets are lifetime cumulative goals. Higher stages require more completed facts, never payment or random rewards. Rank 0 is locked; rank 5 is maximum and has no next goal. Each threshold stores its own first factual crossing time in the derived response, so historical games backfill all supported ranks immediately. The collection reports both themes unlocked out of eight and stages earned out of forty. A loss does not remove a lifetime best-streak milestone; correcting or voiding its underlying matches can.

Regular play counts the Madrid calendar date of the match's end. Multiple matches or activities ending on the same date count once, including across daylight-saving transitions. Wins are unnecessary for that metric. Opponent breadth only adds opposing real player IDs from wins and counts each player once. Partner chemistry maintains a separate win total per real teammate and takes the maximum, rather than adding different teammates together. Its details show the teammate currently holding that record. Ties keep the first record holder in deterministic chronological order. Losing does not subtract wins; score corrections and voiding recalculate all three metrics.

## Facts, permissions and corrections

Achievements are derived on the server from lifetime completed results, in stable end-time/ID order. Each distinct match counts once; a player's streak changes only for their own valid completed matches. Teammates count as partners, opponents do not. Friendly completed games can count, while cancelled, forfeited, pending, incomplete, malformed or future results cannot.

The projection applies the viewer's event visibility before deriving achievements. A member cannot infer private draft results from new badges. Finished historical facts survive an activity's soft deletion; a corrected loss or voided match recalculates the collection. These are factual achievements, not irrevocable awards: historical corrections can remove a badge or alter its unlock date.

No database migration or new award-write endpoint is required. Clients cannot submit unlocks. Achievements do not add ranking points, Elo, financial charges or permissions. Conditional-read metadata expires at future factual completion boundaries so a newly due result is not hidden by an unchanged revision.

## Assets and performance

Artwork was generated using the built-in imagegen tool. The transparent 256px badge themes total about 175 KiB. Five shared 384px transparent rank frames add about 166 KiB and combine with every theme, providing forty distinct rank/theme appearances without forty redundant images. Bronze is a simple copper rim; silver adds leaves and a pearl; gold adds feather wings and cloud engraving; platinum adds layered wings and teal filigree; diamond adds crystal wings, a crown and jewel. The original theme stays visible inside each hollow frame. All artwork loads lazily. Original PNGs remain in ignored local work directories. See [asset prompts and paths](ACHIEVEMENT_ASSETS.md) and [rank frame prompts](ACHIEVEMENT_RANK_ASSETS.md).

## Verification

Regression tests cover milestones, factual unlock dates, personal streak order, distinct partners and defeated opponents, Madrid calendar dates, individual partner records, duplicate records, best-of-three wins, invalid/future games, score corrections, voiding, archived activities, private drafts and conditional-read boundaries. A catalog guard prevents two themes from using the same metric. All eight referenced badge files are validated as actual 256px WebP assets with a combined size below 256 KiB.
