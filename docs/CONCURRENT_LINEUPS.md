# Concurrent lineup editing

Two administrators can edit independent live courts or different published rounds
without an unrelated club revision blocking one of them. Each request must include
the teams or round lineup that the editor displayed. On a transactional commit
race, the handler reloads authoritative state and rechecks that snapshot, current
permissions, eligibility and other-court conflicts before retrying. Two changes
to the same displayed lineup cannot silently overwrite one another: one wins and
the stale request receives 409. Legacy requests without a lineup snapshot retain
the global revision check. Other command families keep their existing behavior.

The activity match tab polls every three seconds while it has draft, published or
playing rounds, including planned and round-by-round scheduling. Live views retain
their existing fast polling. Background/offline polling remains paused.

Accepted snapshots and acknowledged write revisions form a lower bound for later
reads. Older reads cannot rewind the displayed teams. Post-write/conflict reads
discard the previous conditional validator. A stale live-lineup editor closes
with an explicit update message; a 409 refreshes the view and requires a fresh
selection. A two-click published-round selection is invalidated when its captured
lineup, round status or selected player's editability changes.

Validation uses distinct authenticated administrators with real handlers and an
isolated SQLite/D1 adapter, plus the real ClubApp state/transport lifecycle. It
covers independent courts, same-court conflicts, stale teams, permissions,
identical persisted views, editor invalidation, conflict refresh, delayed reads,
acknowledged revision bounds and polling. Tests never modify production matches.
