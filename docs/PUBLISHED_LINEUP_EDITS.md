# Published lineup edits

Activity creators and administrators can exchange two players in draft, published or partly started rounds while the affected matches are still unstarted. Planned lineup editing has no operation-time window: it is available before the activity starts, after a round's estimated start, and after the activity's scheduled end when an unplayed plan remains. Editing a plan does not start a match.

The planned bench includes enabled, confirmed participants registered for the round's venue, including temporary guests. Estimated round duration, arrival/departure windows and current occupancy do not remove them from the planned editor or reject a swap. The real start independently checks actual attendance, booking availability and other matches. An unavailable published lineup waits until it can start safely. Waitlisted, disabled and wrong-venue players are excluded; one person cannot occupy two positions in a round.

Other rounds, recorded scores, permissions, fixed-partner definitions and lock behavior retain their existing protections. The UI snapshots the lineup for concurrency control, the API saves atomically, and an old score dialog cannot award a result to substituted players. Read-only historical score facts are never changed by editing an unplayed plan.

Regression coverage includes before-start and after-end edits, expired estimated slots, future arrivals, currently occupied players, actual start validation, venue and registration restrictions, SQLite rollback, stale selections and member permissions. Tests use fictional data only.
