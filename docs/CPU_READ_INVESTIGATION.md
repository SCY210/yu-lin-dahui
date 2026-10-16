# CPU-limit investigation and read-path changes

## Evidence and its limits

The October 16, 2026 investigation found four distinct `exceededCpu` invocation
records in the selected local-day window, although the earlier aggregate metric
reported three. Each invocation also emitted an exception event. The requests
were one complete `GET /api/club` (29 ms CPU), one activity-scoped `GET /api/club`
(10 ms CPU), and two `GET /` document loads (10 ms CPU each). They came from the
release containing shared commit `cbd13dd5a8e270ffbd9f64c7da3d2d27f2cdfa3b`.

The retained logs identify requests and outcomes, not individual JavaScript
functions. No historical CPU profile was available. The difference between the
aggregate and invocation counts is unresolved; the investigation uses distinct
invocations rather than counting both events as separate requests. Request IDs,
private account details and raw request headers stay outside this repository.

Local profiling against main at `6f014e7a6b1e9a0c29e321f05b2ee523f26cef8f`
identified repeated stored-JSON parsing, repeated realm-ledger computations,
ICU date-formatter construction, history scans and complete-response
serialization. These are reproduced hotspots, not a claim that a historical
exception identified the exact function that crossed the limit.

## Changes

- The authenticated page renders the existing accessible loading screen before
  mounting the application in the browser. The full application module is not
  evaluated by server rendering. Server authentication and API authorization
  still run as before.
- Madrid date formatting reuses one ICU formatter. Time-zone and daylight-saving
  behavior remain covered by the existing tests.
- Incremental snapshots decode stored rating-change rows only when accessed.
  Normal maintenance replaces those derived rows without parsing the obsolete
  copy. Independent rollback snapshots, exports, corruption checks on access,
  updates and concurrent readers are tested.
- Maintenance and view projection reuse the same revision-bound realm ledger.
  Rating refresh owns only its mutable player records and derived rows.
  Existing clock boundaries and permission checks remain in force.
- Social history indexes completed matches by player once; tests compare its
  output with the original per-player full scan.
- Normal reads return the last 50 authorized audit rows, exactly what management
  displays. The unused `ratingHistory` response field stays as an empty array.
  Explicit history-recalculation previews and authorized full exports retain
  complete history. No stored business records are deleted.

Live score and lineup polling stays at three seconds. Polling backoff, revision
invalidation, conflict recovery and activity scope behavior are unchanged.

## Reproduction and validation

Run `npm run install:ci` and `npm run verify`. The latter includes privacy,
repository, type, lint, migration, unit, handler/UI integration and production
build checks. Dedicated checks cover the server/client entry boundary, output
equivalence, scoped reads, next-poll score and lineup changes, permissions,
rollback and full exports.

For a local handler rehearsal, run:

```sh
node tests/cpu-read-rehearsal.mjs --baseline --three-hours
node tests/cpu-read-rehearsal.mjs --three-hours
```

The optional baseline uses Git objects from the exact main revision above; a
shallow checkout must fetch that commit first. The fixture contains 22 fictional
players, 180 matches and 600 audits. Twenty readers issue 72,000 polls over three
simulated hours, with 359 committed score corrections. One owner requests the
complete response and 19 members request the current activity. Reports are
written under ignored `.test-output/`. Synchronous stage timings are inclusive
and must not be added together. Readers run sequentially for comparable per-call
timing; concurrent snapshot isolation is exercised separately by the incremental
read test. This benchmark is not a network-concurrency test.

The paired three-hour rehearsal on the same workstation produced:

| Response | Count | Baseline P95 | Optimized P95 |
| --- | ---: | ---: | ---: |
| Complete owner read | 722 | 25.51 ms | 17.15 ms |
| Activity member read | 13,718 | 5.45 ms | 3.51 ms |
| Unchanged / 304 | 57,560 | 0.156 ms | 0.150 ms |

Realm-ledger computations fell from 2,158 to 719 and stored-record parses from
25,479,848 to 16,238,248. Uncompressed response bytes fell from 877,208,746 to
605,159,072. Complete reads still exceed 10 ms of **local elapsed time**; these
results must not be relabeled as proof that every production invocation meets
the CPU limit. The separate activity API fixture reduced its complete response
to 189,717 bytes and retained a 21,007-byte activity response.

The separate incremental-store capacity test additionally models cold readers
every five minutes. Its conservative budget is 2,593,440 D1 rows read and 32,960
rows written, including allowances, against daily free quotas of 5,000,000 and
100,000. The 72,000 polls leave 28,000 Worker requests for navigation, reminders,
writes, retries and other account traffic.

These are isolated SQLite/Node rehearsals with mocked authentication, not a
three-hour production load test. Local elapsed time is not Cloudflare CPU time.
Complete first reads remain more expensive than scoped/conditional reads, and
the free plan's per-invocation CPU limit is a separate constraint from its daily
request and D1 quotas. A passing capacity rehearsal does not guarantee that no
cold production request can exceed the CPU limit. Check the exact deployed
version and its live CPU outcomes after the protected private release.
