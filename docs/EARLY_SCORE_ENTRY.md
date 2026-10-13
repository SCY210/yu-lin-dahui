# Early score entry

An activity's signed-up accounts can enter results for published matches without
starting the activity or waiting for the scheduled round. Existing score
permissions still apply; unpublished drafts and cancelled/deleted activities
cannot use this path. Only confirmed, valid lineups may receive a result.

The server retains the scheduled round, event, court, and participation times.
For a result entered before its scheduled start, it records `earlyScoreAt` from
the server clock. This makes the saved result count in live season points
immediately, in the scheduled activity period. Ordinary future-dated records
without that server marker remain excluded. Realms retain their existing
settlement-after-activity policy.

Score corrections preserve the first entry marker and replay the result rather
than counting another game. Saving a published result does not start the points
session or trigger a live scheduling advance. Request deduplication, optimistic
concurrency, and transaction rollback use the existing score API.

Regression coverage: `tests/early-score-api.mjs`.
