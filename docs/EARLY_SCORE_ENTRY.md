# Planned score entry without a clock gate

Signed-up accounts and activity managers can enter results for published matches without waiting for the scheduled round. A pending court retains its score button when another court has already changed the round to in progress. Existing score permissions still apply; unpublished drafts, cancelled/deleted activities, malformed teams and invalid final scores remain protected.

Recording a confirmed planned result is not a new start request. It does not revalidate arrival/departure, the estimated slot or current court occupancy. Those checks still govern actual automatic starts. This also covers late result entry after the activity has ended.

During an ongoing activity, a first entry without an explicit historical end records the completion at the server clock. If the estimated start is still in the future, its score start is bounded just before completion rather than keeping a future completion time. The score and any ready next published court are committed together, using normal per-court continuation. The round remains in progress until all courts finish.

Before the activity itself begins, scheduled attribution and the server-recorded earlyScoreAt marker remain in use; saving a future result does not start a future activity. Explicit valid historical timestamps retain their existing behavior. Recorded timestamps stay inside the activity, including outdated estimated slots beyond its end. Score corrections preserve the original facts and do not start another next match.

Idempotent requests, lineup snapshots, concurrent-score conflict checks, valid best-of-three results and SQL rollback remain in force. Tests use isolated fixtures and never record production scores.

Regression coverage: tests/planned-score-clock.test.ts, tests/early-score-api.mjs and the existing per-court/concurrent score suites.
