# Published lineup edits

Activity creators and administrators can exchange two players in a draft,
published or partly started round before the affected matches start or receive scores. The
exchange can involve two courts or an on-court player and a bench player.
Publishing is preserved; the organizer does not need to recreate the schedule.

The bench is derived from current confirmed participation and the round's venue
and full time window. Later signups and temporary guests can therefore enter a
previously published round. Waitlisted, unavailable, disabled and wrong-venue
players cannot be inserted. A player currently playing another match can still
be assigned to an unstarted planned round: current court occupancy is not future
availability. The start action independently rechecks live occupancy and rejects
double-booking. Each person occupies at most one position within the edited round.

Locked pending matches must be unlocked first. Started, scored, forfeited, or
cancelled matches cannot be changed through this flow. When one match of a
round has already been scored, the remaining unstarted matches may still be
edited; recorded participants, results, and points remain untouched. Other
rounds and fixed-partner definitions retain their existing behavior.

The UI snapshots the lineup on the first selection. A concurrent change causes
a stale-selection error instead of swapping unexpected positions. Changes are
staged and validated before application; the API also retains its transaction,
revision, audit, and request-id protections. Score dialogs also capture both
original teams: changing participants invalidates an open score form, and the
server rejects a stale score instead of awarding it to the new players.

Regression coverage: `tests/published-swap-api.mjs` and scheduler UI tests.
