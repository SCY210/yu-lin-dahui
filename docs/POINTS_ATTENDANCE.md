# Starting points play and confirming arrivals

The activity creator and administrators can start points play from the scheduling
page. The action starts the current live scheduler, creates and starts a first
manual round, or publishes and starts the first preplanned round. Existing running
games are retained. It requires the actual activity window and checks a current
mode/pending-match snapshot; repeated starts do not create extra matches.

For a current unscored lineup, the manager may explicitly mark a player late.
The default replaces only that player with a present bench member, retaining the
other players. An optional whole-group replacement excludes the original lineup.
Venue participation, signup intervals, occupied courts and rest preferences are
checked. Single-person substitution may temporarily override fixed partners in
that match; future partner settings stay unchanged.

An unplayed replaced match is cancelled without a score or win/loss. Its successor
has a fresh ID and actual start time. If a valid replacement is unavailable, the
court waits and exposes a retry action; no fictional result or forced extra player
is created. Cancelled attempts do not count as played appearances.

Lateness deducts exactly one point per player per activity, on its singles or
doubles points board, assigned to the activity's Madrid start month. It never
changes long-term rating, wins or losses. The player remains excluded from scheduling until
the manager confirms arrival. Arrival keeps the deduction; correcting a mistaken
late mark refunds it. Repeated marks/refunds have zero additional point effect.
An audit-backed ledger is committed atomically with lineup and event metadata.

These controls do not apply to practice activities or group/knockout tournaments.
No historical scores or production data are rewritten, and JSON event metadata
uses the existing persistence schema without a destructive migration.

## Present by default; late versus not coming

At the club owner's request, every confirmed signup is present by default. There is no per-person arrival roster to tick: scheduling already includes everyone except players who are currently marked late or absent. Reports come from the people on the spot, and the two reports are distinguished by whether the player is still coming:

- **Late, still coming** (`pointsLate`, the "someone is late" button): the match is withdrawn and refilled from the bench, the player loses one point on this activity's board, and the long-term rating is unchanged. The activity's organisers, or another present player of the same match, can report it; the late player cannot report themselves. The late player (or their registrant) or an organiser reports the arrival (`pointsPresence` with `arrived`). Only organisers can refund a mistaken mark (`clear-late`).
- **Not coming or unreachable** (`noShow`, the "someone is not coming" button): see `docs/NO_SHOW.md`.

Both confirmation dialogs point to the other option.
