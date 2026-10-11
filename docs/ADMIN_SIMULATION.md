# Administrator scheduling simulation

Activities offers a simulation entry exclusively to administrators, including the
club owner. Direct API reads and writes verify the current authenticated account's
stored administrator role. Members cannot initialize, read, reset or modify it.
Access revocation is checked on subsequent requests and at conditional writes.

Opening the simulation initializes twelve fictional accounts and players, twelve
confirmed registrations and two courts. Administrators share the same saved test
progress. The activity lasts six hours from initialization; Reset creates a fresh
current-time fixture. Initializing an existing fixture never overwrites progress.
One-click 90-minute preplanning is available without waiting for a future start.

The simulation uses the actual scheduling, score, lateness and rotation commands.
Its commands and state are isolated from the real club. A dedicated settings row
(`admin-simulation-v1`) stores its own graph, revision and bounded request receipts.
It does not modify the club settings row, real accounts, players, activities,
rankings, expenses, commit revision or notification queues. Ordinary club reads and
exports never include the simulation row. No schema migration is needed.

Only scheduling, arrival and scoring operations are allowed in the sandbox.
Real account management, profiles, fees, uploads and notifications are rejected.
Optimistic revision checks and request deduplication prevent duplicate scoring or
one administrator resetting another administrator's newer work. The response is
not cached. Simulated scores and late deductions remain inside the isolated graph.

The simulated page suppresses real score-reminder dialogs and notification prompts.
No real member is registered or messaged. Account changes remount the view, and
permission failures clear the displayed simulation instead of retaining stale data.
