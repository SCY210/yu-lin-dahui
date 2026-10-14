# Worker CPU budget

The club runs on Cloudflare's free Workers plan, which stops a request after 10 ms of CPU time. Network and D1 waiting time do not count; JavaScript work does. Every member's phone polls the club read every 3 seconds during a live activity and every 15 seconds otherwise, and there is no conditional-read cache while an activity is running. CPU per read therefore decides whether a weekly session fits the free plan. In October 2026 the club received a "hit CPU limit" notice for more than 100 requests from about 20 visitors.

## Where the time went

Measured on a fictional club with 22 players, 30 activities and 600 matches (`club()` in `tests/performance.test.ts`):

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

## Merge requirements

Every PR that touches server code (`app/api`, `lib`) must:

1. Keep the per-request CPU of a club read within the 10 ms free-plan budget for a club of the current size. Do not add work that runs on every poll unless it is cheap or shared.
2. Never scan the whole history once per player, per activity or per match. Build a map or index once per request and pass it down.
3. Share results that do not depend on the viewer per stored revision through `sharedClubValue`, and give them a validity window that ends at the next clock boundary that can change them (`sharedViewValidUntil`). Never share results that depend on the viewer, permissions or unsaved changes.
4. When optimizing, prove that the output is unchanged: compare the full projection before and after on a fictional club, including viewers with different permissions and a live activity.
5. Keep `tests/performance.test.ts` passing. It runs in `npm run verify` on every PR. It checks `month()` against `Intl` every hour for two years, shared against per-request projections, cache expiry, maintenance equivalence, absolute budgets that the old code fails, and that tripling the members and activities does not multiply the cost by nine. Do not loosen a budget to make a change pass; find the scan that grew instead.

Other test files run in parallel, so CPU contention can slow any single run. Timing assertions therefore take the fastest of several alternating runs (contention only adds time), compare growth ratios with a wide margin, and keep absolute budgets generous; a median of a few runs was not enough on a shared CI runner. Locally, profile with `node --cpu-prof` against the same fixture before and after a change.

## Plan limits

These changes keep a normal session inside the free plan, but they cannot guarantee it: a much larger club, many simultaneous viewers on cold isolates, or a future feature can still exceed 10 ms. Workers Paid (USD 5 per month) raises the limit to 30 seconds of CPU per request. That decision belongs to the repository owner.
