# Live court rotation

Each court advances independently after a valid single-game score. A finished court waits for the Start grouping button (`liveNext`), available to signed-up players, the organiser and administrators. Other courts keep playing. Scores and lineup commands use the existing optimistic, idempotent D1 transactions.

## Winner preference with a two-win break

Available doubles winners are preferred for their next game. Waiting players fill the remaining places as a queue: whoever has waited longest since their previous game goes first, then fewer appearances. The selected four use the existing strength, gender and match-history pairing algorithm; the winners may remain partners or be split. Fixed-partner mode keeps complete pairs intact.

To improve strength, variety or avoid a rematch, the pairing may swap a selected bench player for one whose wait differs by at most one game, so nobody is passed over for more than about one extra game.

Rotating live doubles now include partner repetition in the strength comparison, rather than only as a final tie-breaker. Each immediately repeated pair costs 24 Elo-equivalent points; historical pair uses contribute 4 each, capped at 16 for frequency. The combined live partnership penalty is capped at 40. Thus a modest strength difference can permit new partners, while a large mismatch cannot be justified by unlimited repetition penalties. Gender safeguards still rank first. Fixed partners, singles and planned scheduling do not opt into this additional cost. History is indexed once and each candidate uses only map lookups.

After two consecutive retained wins, automatic selection sends each winning player off court for one complete game. The personal run follows `liveRetained`, so changing partners on court does not reset it. A loss resets it, and a new turn from the bench starts at one. This affects live doubles rotation only; ranking streaks, rewards, singles and tournament scheduling are unchanged.

The score transaction persists a `two-wins` break. The player is excluded from automatic selection and winner reservations at every venue. Ready-again, disabling the voluntary-rest preference, pause/restart and `allowSame` cannot bypass it. An authorized manual swap or lineup edit may explicitly put that player back on court before the break finishes, clearing only that selected player's automatic break in the same audited transaction. Voluntary rest, fixed-partner rules, attendance, other active games, scores and concurrency guards remain protected. A later-started game at the same venue must finish before the break releases; finishing a game that was already in progress does not count. When substitutes are insufficient, the court waits, including four-player groups. Fixed teams are never split to fill a court.

Availability still respects signup/booking windows, disabled or stopped participants, absence holds and explicit voluntary breaks. The fix does not bypass these independent controls or split fixed partners. If fewer than four genuinely available players (or fewer than two complete fixed teams) remain, the court waits. Singles retain their existing explicit same-player option.

## Compatibility with existing activities

The retired `reason: 'win-limit'` rest entries may remain in persisted JSON, but are ignored immediately by server selection and manual-lineup eligibility. Normal responses omit them so old tabs do not display the obsolete forced-break status. Scoring clears old entries as part of its normal transaction. No reset, record deletion or separate production-data migration is needed. The same compatibility behavior applies to saved simulation documents.

New scores use the distinct `two-wins` reason for the current mandatory rule. Legacy `win-limit` entries remain ignored rather than being resurrected. Voluntary breaks keep their existing ready-again control; automatic two-win breaks may instead be overridden by manual lineup changes. All off-court players remain visible with avatars and profile links, without rest labels. No migration of historical scores is performed.

## Current lineup corrections and refresh

Creators, administrators and accounts with a confirmed signup may exchange partners, a court player with a waiting player, or players on separate courts before scoring through the two-player swap controls. Waitlisted, cancelled, disabled and unrelated accounts cannot use these controls. A proxy guest's signup grants no authority to the registrant. The legacy full-lineup replacement command remains organiser-only. Fixed partners remain protected. Current-lineup snapshots, permissions, duplicate players, other active games, attendance and voluntary breaks are checked on the server. Stale requests return 409 and failed transactions roll back. Corrections preserve match IDs, start times and completed results.

## Manual play after the scheduled end

An organiser may start live play or switch an expired activity to live mode after its scheduled end. Signed-up accounts may then request the next game, and confirmed accounts may swap an unscored current lineup. The final scheduled court and signup phase supplies the available players; earlier departures, voluntary breaks, absence holds, fixed partners and other active games still apply. Drafts, cancellation, deletion, a manual closure before the scheduled end and the before-start gate remain protected.

Overtime games store their actual start and completion timestamps. Activity dates, booking intervals, registration times and fee allocation durations remain unchanged. The usual end-time projection and voting rules remain clock-based. Expired activities never restart through background maintenance: overtime games require an explicit action. Conditional reads retain the existing activity-end boundary, so clients see the transition without a new polling policy or database migration.

The retained-player marker describes the current personal on-court run and controls the two-win break. Existing games and scores are unchanged. Visible activity pages retain three-second refreshes with hidden/offline suppression. This change introduces no new clock-driven state transition or SQL migration.

## Simulation and validation

Simulation uses the same domain commands and view in its isolated document. Tests cover mandatory breaks with 4/5/6 players, fixed-team wins, restart protection and authorized manual-lineup overrides, staggered courts, return from rest, imported legacy win-limit rows, manual substitution, cross-idle-court fallback, voluntary rest, busy-player exclusion, scoped response compatibility, persistence, rollback, idempotence and concurrent next-game requests. Simulation tests also verify that real club state remains unchanged.
