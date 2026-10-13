# Owner-only manual rating increases

Group management has a visible **manual rating increase** card above the existing
points controls. The owner selects an enabled permanent member and an integer
increase of 1–300. The player selector shows the member's currently settled visible
rating. Guest and disabled profiles are excluded.

This uses the existing authenticated `grantPoints` command with `points: 0` and a
positive `rating` delta. It changes rating, eligible realm progression and doubles
grouping strength without adding season points, games or wins. Placement remains
placement. Existing inactivity, settlement and replay policies remain in force.
The old participant-status toggle still only enables or disables participation.

The server checks the persisted club owner; an administrator role or a forged
`isOwner` payload is insufficient. The existing D1 transaction and audit ledger
persist the adjustment. Reloads and historical rule replays read that ledger.
No new table or database migration is needed.

Manual grant forms retain one request ID across retry attempts. Explicitly opening
a new form creates a new operation, preventing an ambiguous response from applying
the same increase twice. Rating changes have their own compact history; the points
history excludes rating-only records while preserving earlier mixed adjustments.

Isolated UI/API tests cover discoverability, ownership, eligible players, a zero
points payload, persistence, visible rating, grouping strength, replay, unchanged
game/points totals, duplicate requests and rollback. No real member's rating is
changed by validation.
