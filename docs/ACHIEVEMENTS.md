# Lifetime achievements

The first collection contains eight original imagegen badges. Members can inspect their own collection under the account tab and view the same collection on a player's profile. Locked cards show progress, earned cards show the artwork and unlock date, and a details panel explains each milestone. A same-account refresh can announce newly unlocked milestones; initial loads and identity switches do not announce historical awards.

| Badge ID | Requirement |
|---|---|
| first-flight | Complete one valid match |
| first-victory | Win one valid match |
| ten-matches | Complete ten valid matches |
| fifty-matches | Complete fifty valid matches |
| ten-victories | Win ten valid matches |
| three-streak | Reach a three-match personal winning streak |
| five-partners | Complete matches with five distinct teammates |
| three-game-victory | Win a completed best-of-three match that reaches three games |

## Facts, permissions and corrections

Achievements are derived on the server from lifetime completed results, in stable end-time/ID order. Each distinct match counts once; a player's streak changes only for their own valid completed matches. Teammates count as partners, opponents do not. Friendly completed games can count, while cancelled, forfeited, pending, incomplete, malformed or future results cannot.

The projection applies the viewer's event visibility before deriving achievements. A member cannot infer private draft results from new badges. Finished historical facts survive an activity's soft deletion; a corrected loss or voided match recalculates the collection. These are factual achievements, not irrevocable awards: historical corrections can remove a badge or alter its unlock date.

No database migration or new award-write endpoint is required. Clients cannot submit unlocks. Achievements do not add ranking points, Elo, financial charges or permissions. Conditional-read metadata expires at future factual completion boundaries so a newly due result is not hidden by an unchanged revision.

## Assets and performance

Artwork was generated using the built-in imagegen tool, with the first badge as a style reference. The transparent 256px WebP collection totals about 175 KiB and loads only when the collection is rendered. Original generated PNGs remain in the ignored local work directory. See [asset prompts and paths](ACHIEVEMENT_ASSETS.md).

## Verification

Regression tests cover milestones, factual unlock dates, personal streak order, distinct partners, duplicate records, best-of-three wins, invalid/future games, score corrections, voiding, archived activities, private drafts and conditional-read boundaries. All eight referenced badge files are validated as actual 256px WebP assets with a combined size below 256 KiB.
