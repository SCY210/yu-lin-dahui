# Worker CPU budget

The club runs on Cloudflare's free Workers plan, which stops a request after 10 ms of CPU time. Network and D1 waiting time do not count; JavaScript work does. Every member's phone polls the club read every 3 seconds during a live activity and every 15 seconds otherwise, and until October 2026 a running activity disabled the conditional-read cache. CPU per read therefore decides whether a weekly session fits the free plan. In October 2026 the club received a "hit CPU limit" notice for more than 100 requests from about 20 visitors.

## Where the time went

Measured on a fictional club with 22 players, 30 activities and 600 matches (`club()` in `tests/helpers/performance-fixture.ts`):

| Work per club read | Before | After |
| --- | --- | --- |
| View projection, computed per request | 169 ms | 27 ms |
| View projection, shared within one isolate | — | about 5 ms per viewer |
| Load maintenance of an unchanged revision | about 12 ms | about 2 ms |

The main costs were:

- `month()` called `Intl.DateTimeFormat#formatToParts` on every call (41% of the projection). It is now cached per UTC hour, which is exact because Madrid's offset is a whole number of hours.
- Social statistics refiltered all finished matches once per player and once per activity. The finished list is computed once and passed down.
- `aggregateLeaderboard` scanned every match once per player. It now builds the per-player game count in one pass.
- Active avatar streaks replayed the full history twice. One pass now keeps only each player's latest format.
- Automatic coin reconciliation looked up registrations, attendance and played matches with full scans per player and per activity. It now builds one index per call.
- Every load cloned the whole state for a rollback snapshot that is only needed when maintenance saves. The snapshot is now rebuilt from the already fetched rows on demand.

## Shared results

`lib/club-view-shared.ts` keeps a small in-isolate cache keyed by the stored revision. Results that are the same for every viewer (realm rating ledger, ranking boards, history statistics, the clock-driven realm rating refresh, the coin ledger) are computed once and reused by every member's request until the next moment they could change on the clock, at most 15 seconds. Viewer-specific parts (draft visibility, permissions, fees) are keyed by what the viewer can see or computed per request. Only the read route and the load maintenance of an unchanged stored revision opt in; commands, saves and other callers compute everything. A cold isolate simply computes again, so correctness never depends on the cache.

## Live conditional reads

A running activity used to turn every poll into a full read: load every row, run the clock-driven maintenance, project the view and serialize about 1 MB. On the fictional club that was about 13 ms of CPU per poll with shared results, and every poll read every database row.

Now `clubViewValidUntil` (`lib/club-read-cache.ts`) also lets a running activity reuse its validator, for 15 seconds at most (`liveMaxAge`) and only until the next live clock boundary (`liveBoundaries`):

- the activity end, the points window, and every round start and end (published rounds start on the clock);
- every court booking and every signup span (arrival, departure, per-court signups, waitlist promotion), plus the moment a court or player can no longer last a whole round;
- each moment the remaining-round count of the current court and attendance phase drops (`pointsRoundWindows`).

Any write still changes the revision, so scores reach every phone on its next poll. Simulated 3-second polling through whole activities answers about 80% of live polls with 304, which costs only authentication and three indexed metadata rows. Live CPU and D1 rows read drop to about a fifth. Request counts do not change; each 304 is still a Worker request. Activities with legacy check-in attendance bill elapsed minutes continuously and stay on full refresh.

`tests/live-conditional-read.test.ts` walks whole fictional activities and checks that inside every reuse window neither any viewer's projection nor the clock-driven maintenance (auto-started rounds, refilled live courts, coin settlement) changes. Removing the live boundaries fails all of its scenarios.

## Incremental persistence reads

The read route opts into a server-side raw-row snapshot (`lib/incremental-store.ts`). The first request in each Worker isolate loads a consistent snapshot. Subsequent reads use the indexed change cursor and fetch only inserted, updated or deleted rows. A quiet 15-second refresh no longer scans all business tables. SQL triggers in migration 0016 record changes in the same transaction as the underlying write, including writes outside `save()`. No change-feed data is exposed to browsers. Authorization and current account permissions are still checked on every request; exports and write commands retain fresh full loads.

Snapshots contain immutable raw JSON strings and are limited to 16 MiB of UTF-16 payload per database. Each caller gets separately parsed objects, and rollback restores capture the original snapshot. Concurrent refreshes serialize their database synchronization. A cold isolate, a cursor outside the retained 4,096 changes, a reset cursor, or an oversized update safely falls back to a full transaction. A failed database read never serves stale data. Saves prune the change feed; its payloads are transient derived state, not an authoritative backup. Restore/import procedures must restart Worker isolates, as before, and must retain the migration's triggers.

Automatic scheduling first checks whether a new round can start or a live court is empty, before cloning the club. The GET handler also consumes its own parsed state after recording the validator, avoiding a redundant full clone. Other projection callers keep their previous copy semantics.

### Capacity rehearsal

`tests/incremental-club-read.mjs` exercises the actual SQLite migration and incremental loader with 20 independent readers, 3-second polling for three simulated hours, a cold reader every five minutes, roughly 1,422 historical rows, and nine changed rows every 30 seconds. It deliberately invokes the loader on **every** poll; real 304 hits skip the loader. It validates deletes, transaction rollback, concurrent reads, history pruning, retry, snapshot isolation and an indexed cursor query plan.

The measured rehearsal returned 1,153,440 rows. Adding a reserve of 20 indexed rows per poll for authentication, permissions and ancillary work gives **2,593,440 reads** versus the 5,000,000 daily free allowance. A conservative write estimate including change-feed overhead and 20,000 extra writes is **32,960**, below 100,000/day. There are 72,000 poll requests, leaving 28,000 for other Worker requests within the daily 100,000 allowance. These are whole-account limits: other traffic uses the same reserve. Frequent cold starts, larger histories or a higher write rate require repeating the rehearsal; this is not an unlimited capacity claim.

The generated `.test-output/incremental-club-capacity.json` records the assumptions and counts. Local Node handler timings are not Cloudflare CPU measurements. Validate the deployed revision and invocation metrics separately; do not describe a small post-release sample as proof of a three-hour production load test.

## Merge requirements

The later [CPU read investigation](CPU_READ_INVESTIGATION.md) documents the
confirmed request paths, local profiling, lightweight application entry,
bounded ordinary audit responses and reproducible three-hour handler rehearsal.

## Activity responses and adaptive polling

New clients request `GET /api/club?activity=<id>&month=...&year=...` while viewing an activity. The response carries an explicit `activityScope` and replaces that workspace; it is not merged into a supposedly complete club snapshot. It contains current signups, rounds, scores, costs, fees and activity social data, plus authorized player/identity information, current avatar streaks and the viewer's own achievements. Visible playing matches from other activities are retained only to prevent selecting occupied players. Historical games, full leaderboards, administrative audit rows, rating replay and unrelated fee projections are omitted. Server ranking calculations and persisted results remain unchanged.

Authentication and current permissions still precede every read. ETags bind the activity as well as the viewer, role, revision, period and year. Deleted, merged or inaccessible activities return a freshly filtered full response so navigation can recover. Export reads remain full. The client gates other screens until their requested scope has loaded, rejects late responses and old refresh closures after navigation, and forces a fresh read after writes. Browser-agent overview tools explicitly request full data.

Active match/lineup collaboration and live home cards keep the existing 3-second interval. Home and non-fast activity views retain a 15-second ceiling so clock-driven starts do not wait for a long idle backoff. Other screens start at 15 seconds and, after successive unchanged revisions, back off to 30 and then 60 seconds. Any observed new revision resets the delay. Returning to the foreground or receiving the existing wake events refreshes immediately; offline/hidden pages stop polling. Failures retry with bounded backoff and never overlap reads. Finished/cancelled activities no longer retain fast polling merely because an old live-play flag remains.

The authenticated synthetic handler fixture (200 historical matches, 600 audit rows) measured 633,122 bytes for the full response and 20,983 bytes for the activity response (96.7% smaller, before compression). `tests/club-activity-api.mjs` verifies next-poll score/lineup changes, permission changes, scoped 304s and full-view recovery. `tests/club-lineup-sync-ui.mjs` verifies navigation gates, stale closures/responses and write conflict recovery. Live boundary tests exercise both full and activity projections.

For 20 viewers over three hours, continuous live collaboration still has a worst-case 72,000 scheduled poll requests. Quiet browsing falls below 4,000 scheduled polls. The prior conservative D1 rehearsal deliberately runs the incremental loader on all 72,000 polls, so its read/write budget remains the upper-bound scenario for this change under the same data, write-rate and cold-start assumptions. Reminder requests, explicit user actions, navigation, retries and other account traffic use the remaining request reserve; these calculations are not an actual three-hour production stress test or a guarantee for unlimited traffic.

## Merge requirements

Every PR that touches server code (`app/api`, `lib`) must:

1. Keep the per-request CPU of a club read within the 10 ms free-plan budget for a club of the current size. Do not add work that runs on every poll unless it is cheap or shared.
2. Never scan the whole history once per player, per activity or per match. Build a map or index once per request and pass it down.
3. Share results that do not depend on the viewer per stored revision through `sharedClubValue`, and give them a validity window that ends at the next clock boundary that can change them (`sharedViewValidUntil`). Never share results that depend on the viewer, permissions or unsaved changes.
4. When optimizing, prove that the output is unchanged: compare the full projection before and after on a fictional club, including viewers with different permissions and a live activity.
5. Any new behaviour that changes a view or runs maintenance on the clock during an activity must add its moment to `liveBoundaries` (or to `clubViewValidUntil` outside activities) and a scenario to `tests/live-conditional-read.test.ts`. A missed boundary leaves phones up to 15 seconds behind and delays the clock-driven action until the next full read.
6. Keep `tests/performance.test.ts` passing. It runs in `npm run verify` on every PR. It checks `month()` against `Intl` every hour for two years, shared against per-request projections, cache expiry, maintenance equivalence, absolute budgets that the old code fails, and that tripling the members and activities does not multiply the cost by nine. Do not loosen a budget to make a change pass; find the scan that grew instead.

Other test files run in parallel, so CPU contention can slow any single run. Timing assertions therefore take the fastest of several alternating runs (contention only adds time), compare growth ratios with a wide margin, and keep absolute budgets generous; a median of a few runs was not enough on a shared CI runner. Locally, profile with `node --cpu-prof` against the same fixture before and after a change.

## Plan limits

These changes keep a normal session inside the free plan, but they cannot guarantee it: a much larger club, many simultaneous viewers on cold isolates, or a future feature can still exceed 10 ms. Workers Paid (USD 5 per month) raises the limit to 30 seconds of CPU per request. That decision belongs to the repository owner.
