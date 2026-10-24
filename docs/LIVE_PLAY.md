# Live court rotation

Each court advances independently after a valid single-game score. A finished court waits for the Start grouping button (`liveNext`), available to signed-up players, the organiser and administrators. Other courts keep playing. Scores and lineup commands use the existing optimistic, idempotent D1 transactions.

## Winner preference without a win limit

Available doubles winners are preferred for their next game. Waiting players fill the remaining places, favoring fewer appearances and an earlier previous turn. The selected four use the existing strength, gender and match-history pairing algorithm; the winners may remain partners or be split. Fixed-partner mode keeps complete pairs intact.

Rotating live doubles now include partner repetition in the strength comparison, rather than only as a final tie-breaker. Each immediately repeated pair costs 24 Elo-equivalent points; historical pair uses contribute 4 each, capped at 16 for frequency. The combined live partnership penalty is capped at 40. Thus a modest strength difference can permit new partners, while a large mismatch cannot be justified by unlimited repetition penalties. Gender safeguards still rank first. Fixed partners, singles and planned scheduling do not opt into this additional cost. History is indexed once and each candidate uses only map lookups.

There is no two-win limit and no automatic break caused by consecutive wins. Retention is a preference, not an eligibility lock. Recent losers and winners waiting at another idle court remain candidates when substitutes are scarce. Four available players can keep playing without an override flag; five- and six-player groups can rotate without waiting for nonexistent substitutes. Other courts' waiting winners are used only after unreserved candidates. Players currently playing elsewhere are always excluded.

Availability still respects signup/booking windows, disabled or stopped participants, absence holds and explicit voluntary breaks. The fix does not bypass these independent controls or split fixed partners. If fewer than four genuinely available players (or fewer than two complete fixed teams) remain, the court waits. Singles retain their existing explicit same-player option.

## Compatibility with existing activities

The retired `reason: 'win-limit'` rest entries may remain in persisted JSON, but are ignored immediately by server selection and manual-lineup eligibility. Normal responses omit them so old tabs do not display the obsolete forced-break status. Scoring clears old entries as part of its normal transaction. No reset, record deletion or separate production-data migration is needed. The same compatibility behavior applies to saved simulation documents.

New scores never create win-limit breaks. Only an explicit non-consecutive-play preference creates a voluntary break; the ready-again action can end it. A legacy win-limit entry cannot prevent ready-again, prevent disabling that preference, reserve a court or lock a player out of matching.

## Current lineup corrections and refresh

Creators and administrators may exchange partners, a court player with a waiting player, or players on separate courts before scoring. Fixed partners remain protected. Current-lineup snapshots, permissions, duplicate players, other active games, attendance and voluntary breaks are checked on the server. Stale requests return 409 and failed transactions roll back. Corrections preserve match IDs, start times and completed results.

The historical retained-player marker can still describe personal winning runs, but it no longer controls eligibility. Existing games and scores are unchanged. Visible activity pages retain three-second refreshes with hidden/offline suppression. This change introduces no new clock-driven state transition or SQL migration.

## Simulation and validation

Simulation uses the same domain commands and view in its isolated document. Tests cover 4/5/6-player repeated games, repeated fixed-team wins, imported legacy win-limit rows, manual substitution, cross-idle-court fallback, voluntary rest, busy-player exclusion, scoped response compatibility, persistence, rollback, idempotence and concurrent next-game requests. Simulation tests also verify that real club state remains unchanged.
