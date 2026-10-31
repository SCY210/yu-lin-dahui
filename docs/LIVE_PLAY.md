# Live court rotation

Each court advances independently after a valid single-game score. A finished court waits for the Start grouping button (`liveNext`), available to signed-up players, the organiser and administrators. Other courts keep playing. Scores and lineup commands use the existing optimistic, idempotent D1 transactions.

## Everyone leaves the court, then a queue

After each game all four players leave the court; winners do not stay on. The next players come from a queue:

1. Waiting players come before the court's just-finished players.
2. Whoever has waited longest since their previous game goes first.
3. Among players who came off the same game, fewer appearances go first, then signup order.

The selected four use the existing strength, gender and match-history pairing algorithm. To improve strength or variety, or to avoid a rematch, the pairing may swap a selected player for one whose wait differs by at most one game and who has not played more. Nobody is therefore passed over for more than about one extra game, and nobody gets ahead in games.

**Breaking up blocks.** Winner retention used to keep the same people from simply swapping partners. Without it, the four players of one game could leave together, queue together and come back together. A game may therefore not take three or more players from one earlier game while others can play. Instead, two of them play with two others, just-finished players included; those who would not get ahead in games come first, then the best balance. In fixed-partner mode two teams that just played each other are not paired again; another team comes in. Complete pairs are never split.

Rotating live doubles include partner repetition in the strength comparison, rather than only as a final tie-breaker. Each immediately repeated pair costs 24 Elo-equivalent points; historical pair uses contribute 4 each, capped at 16 for frequency. The combined live partnership penalty is capped at 40. Thus a modest strength difference can permit new partners, while a large mismatch cannot be justified by unlimited repetition penalties. Gender safeguards still rank first. Fixed partners and singles do not opt into this additional cost. Planned rounds (preplanned schedules, round-by-round generation and added rounds) use the same partner cost. History is indexed once and each candidate uses only map lookups.

There is no win limit and no automatic break caused by consecutive wins. The queue is a preference, not an eligibility lock. When substitutes are scarce, the just-finished players remain candidates. Four available players can keep playing without an override flag; five- and six-player groups can rotate without waiting for nonexistent substitutes. Players currently playing elsewhere are always excluded.

**History and simulations.** Until October 2026 doubles winners stayed on. With no win limit, a strong pair could play 10-15 games in a row while others waited. After losing, they sat out until everyone had caught up, and games played drifted 6-14 apart. A later variant kept winners on with a mandatory break after two wins. Simulated activities (1-4 courts, 6-28 players, the stronger team more likely to win, four hours) compare the current rotation with that variant:

- Games played differ by at most 1-3 across players, against 3-7. One three-court setup with fourteen players drifted 21 games apart under the two-win variant.
- The longest rest is shorter in every setup, for example 66 instead of 96 minutes on one court with ten players.
- The longest run of back-to-back games is 2-4 when six or more players are waiting. With only one or two waiting, runs stay long under any rule, because only that many players can be swapped out per game; the two-win variant limited them by leaving courts or players idle. The do-not-play-consecutively preference remains for players who want a break.
- Team strength differences and the share of reunited foursomes are about the same.

Availability still respects signup/booking windows, disabled or stopped participants, absence holds and explicit voluntary breaks. The fix does not bypass these independent controls or split fixed partners. If fewer than four genuinely available players (or fewer than two complete fixed teams) remain, the court waits. Singles retain their existing explicit same-player option.

## Compatibility with existing activities

The retired automatic breaks, `reason: 'win-limit'` and `reason: 'two-wins'`, may remain in persisted JSON. Server selection and manual-lineup eligibility ignore them immediately. Normal responses omit them so old tabs do not display the obsolete forced-break status. Scoring clears old entries as part of its normal transaction. No reset, record deletion or separate production-data migration is needed. The same compatibility behavior applies to saved simulation documents.

New scores never create automatic breaks. Only the do-not-play-consecutively preference creates a voluntary break; the ready-again action can end it, and manual swaps cannot put that player on court. All off-court players remain visible with avatars and profile links, without rest labels. No migration of historical scores is performed.

## Current lineup corrections and refresh

Creators, administrators and accounts with a confirmed signup may exchange partners, a court player with a waiting player, or players on separate courts before scoring through the two-player swap controls. Waitlisted, cancelled, disabled and unrelated accounts cannot use these controls. A proxy guest's signup grants no authority to the registrant. The legacy full-lineup replacement command remains organiser-only. Fixed partners remain protected. Current-lineup snapshots, permissions, duplicate players, other active games, attendance and voluntary breaks are checked on the server. Stale requests return 409 and failed transactions roll back. Corrections preserve match IDs, start times and completed results.

## Manual play after the scheduled end

An organiser may start live play or switch an expired activity to live mode after its scheduled end. Signed-up accounts may then request the next game, and confirmed accounts may swap an unscored current lineup. The final scheduled court and signup phase supplies the available players; earlier departures, voluntary breaks, absence holds, fixed partners and other active games still apply. Drafts, cancellation, deletion, a manual closure before the scheduled end and the before-start gate remain protected.

Overtime games store their actual start and completion timestamps. Activity dates, booking intervals, registration times and fee allocation durations remain unchanged. The usual end-time projection and voting rules remain clock-based. Expired activities never restart through background maintenance: overtime games require an explicit action. Conditional reads retain the existing activity-end boundary, so clients see the transition without a new polling policy or database migration.

Rounds no longer record retained players. `liveWinStreaks` counts each player's live wins in a row, whatever their partners or courts; older rounds' retained-player markers are ignored. Existing games and scores are unchanged. Visible activity pages retain three-second refreshes with hidden/offline suppression. This change introduces no new clock-driven state transition or SQL migration.

## Simulation and validation

Simulation uses the same domain commands and view in its isolated document. Tests cover the queue, block breaking and even games on three courts, 4/5/6-player groups, fixed-team rotation, staggered courts, return from rest, ignored two-win and imported legacy win-limit rows, manual substitution, cross-idle-court fallback, voluntary rest, busy-player exclusion, scoped response compatibility, persistence, rollback, idempotence and concurrent next-game requests. Simulation tests also verify that real club state remains unchanged.
