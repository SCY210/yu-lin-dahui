# Activity scheduling modes

Singles and doubles offer two modes: the planned schedule (the default) and live per-court scheduling. Practice activities keep signup and fees without competition.

## Default planned schedule

An activity that has no arrangement yet uses the planned schedule. When it starts and nobody has planned it, the clock plans the rest of the activity from the start minute (its points window, round length and confirmed partner mode, `automaticPlanInput`), publishes it and starts the first games (`lib/domain/points-auto-start.ts`). Pressing start by hand does the same. If the plan cannot be made, for example with too few players present, the attempt is remembered with its signups, presence and courts (`pointsSession.autoPlanKey`) and repeated only after one of them changes, such as a new signup or a player's arrival time. Only activities that never had a round are planned automatically; a schedule cancelled on purpose is not recreated. The planned controls are shown expanded.

## Retired one-round mode

"One round after each completed round" can no longer be chosen, and the server rejects switching to it. An activity that already uses it keeps its rounds and controls until it ends, and the selector lets it switch to another mode.

## Switching

The creator or an administrator switches modes through a confirmation carrying the expected mode and pending match IDs. A stale request is rejected. Switching disables live auto-advance and cancels only unstarted draft/published matches from the old arrangement. Completed scores, started matches, attendance, fees and rest preferences remain unchanged. No production records are rewritten by deployment.

Legacy activities infer their mode from enabled live play, existing planned rounds, existing ordinary rounds, or only live rounds; an activity with no rounds at all is planned. Historical planned schedules therefore remain visible. Ended activities are read-only for scheduling.

Planned round headings show the round number and status without an estimated start time. Stored timestamps, round ordering and scheduling behavior are preserved; planning forms and the other modes retain their time controls.

Planned mode restores multi-round creation, draft swaps/court changes, batch publishing, ordered starts, rest rosters, profiles and score entry. After all current games finish, the host can plan remaining time after the current clock without replacing completed games. A legacy one-round activity exposes generation only after current games and pending rounds are resolved. Live mode retains independent score-triggered advancement, bench priority and voluntary rest, and its current games are shown and corrected like a planned round (see `docs/LIVE_PLAY.md`). Selecting live mode does not start games; the host explicitly starts live scheduling during the activity.

After games have finished, remaining-time replanning keeps the confirmed partner mode; existing fixed teams are reused rather than reassigned from changed ratings.

Cancelled arrangements remain available in a read-only archive in all modes. Removing the last pending round does not unexpectedly change the inferred mode of a legacy activity.

Planned lineups remain editable until a score is stored, including legacy automatically started records. Their public state is pending score or ended; scheduler metadata does not block substitutions. Group locking is retired, and old stored lock flags do not restrict edits or generation.

## Attendance phase transitions

The backend advances confirmed planned schedules by actual server time at signup
arrival/departure and court-booking boundaries. At a boundary such as 13:00, it
retires only published, unstarted matches from earlier attendance phases and
continues with the confirmed next phase. This also retires an earlier-phase
match whose four players happen to attend all day; it must not hold up the new
phase. Skipped matches are cancelled without scores, forfeits or point penalties,
and the transition is audited once as `pointsPhaseAdvance`.
Expiration requires a confirmed successor phase. Without one, a final lineup
manually changed to include a later arrival remains pending until that person
can play; the clock does not discard the host's last confirmed adjustment.

A game already in progress continues. Its court and players remain occupied;
other free courts can enter the new phase immediately, and its next match starts
after the current score releases the court. Future phases cannot start early
just because the preceding courts scored quickly. Draft confirmation, historical
results, manual score entry, signup windows and fee allocation are preserved.
No frontend changes or production-data rewrite are needed for existing confirmed
plans. The normal server read/write maintenance commits the transition atomically,
and conditional-read validators expire at the same attendance/booking boundary.

Coverage: `tests/planned-phase-transition.test.ts`,
`tests/live-conditional-read.test.ts` and `tests/points-auto-start-api.mjs` include
partial rounds, exact clock boundaries, actual games crossing the boundary,
unavailable next players and concurrent SQLite-backed maintenance reads.

## Finishing a phase early

When the current phase's confirmed queue has finished but the next confirmed
phase has not begun, the backend fills free courts with new games from the
currently available signup pool. It reuses fair-turn, venue, gender/strength and
fixed-partner grouping; future published matches are excluded from the proposal's
played history. Actual busy players and physical courts remain unavailable.
Each extra game starts immediately and its estimated duration is limited by the
current attendance/booking phase and points window. At least five whole minutes
must remain. A game still in progress at the boundary finishes normally.

Extra rounds receive new slot IDs without renumbering historical or future
rounds. Backend ordering uses attendance phase first, then original slot order,
so repeated gap games do not block behind the later phase's earlier slot IDs.
Future confirmed lineups stay intact. Current drafts/pending games, an intentionally
cancelled phase, insufficient players, and a future phase awaiting confirmation
do not trigger gap filling. Once the entire confirmed schedule is exhausted,
the existing explicit append action remains available while the activity has time.

`pointsGapFill` audits the new games. Score-triggered advancement and read
maintenance use the same transaction; concurrent reads commit only one set of
games. `tests/planned-gap.test.ts` and `tests/points-auto-start-api.mjs` cover
continued play, two simultaneous courts, phase ordering, singles/fixed pairs,
cross-activity occupancy, exact cutoffs and request races. Frontend code is
unchanged.
