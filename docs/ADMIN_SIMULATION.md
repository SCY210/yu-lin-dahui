# Administrator scheduling simulation

Activities offers a simulation entry to the club owner, administrators and authorized member testers. Every API request checks the authenticated account's stored role or independent tester capability; conditional writes check it again. Members without an explicit grant cannot access the sandbox.

Initialization snapshots up to twelve enabled, account-backed club members in
stored roster order, with two courts and confirmed simulated registrations.
Proxy-only friends and disabled profiles are excluded. A smaller club uses its
actual available roster without inventing additional players; an empty roster
returns an error. The UI displays the actual participant count.

Only names, avatar references, declared gender, current settled strength and club
scoring rules are copied. No real account IDs, contact details, historical games,
season points or private profile text are copied. Sandbox accounts, players and
activity records have separate IDs. Existing authenticated avatar reads remain
read-only. Strength is seeded with rating-only audit entries in the sandbox so
normal rating replays preserve the starting snapshot after simulated scoring.

The dedicated settings row (admin-simulation-v1) now stores document version 2.
Opening an old version-1 fictional fixture replaces only that test graph with a
fresh member snapshot, using a version/revision conditional update. Concurrent
initialization cannot overwrite a newer simulation. Reopening a non-expired version 2 preserves
shared administrator progress. Reopening an expired simulation creates a fresh
member snapshot with a conditional revision update. Reset clears test results and takes a fresh club
snapshot. The activity lasts six hours; both courts use the current time window.
One-click 90-minute preplanning and all three scheduling modes remain available.

The actual scheduling, score, absence, lateness and rotation commands run entirely
inside this graph. They never write the club settings row, real accounts, players,
activities, rankings, expenses, commit revision or notification queues. Ordinary
club reads and exports do not include the simulation settings row. No schema
migration is required. Profiles, fees, account management, uploads and real
notifications remain unavailable in the sandbox.

Optimistic revisions and bounded request receipts prevent duplicate scoring and
stale resets. Responses are not cached. Real score-reminder dialogs and notification
prompts are suppressed. Account changes remount the view, and permission failures
clear the displayed simulation. Tests use in-memory SQLite and synthetic member
fixtures; they never connect to production data.

## Current scheduler

The sandbox uses the current production domain commands, including per-court continuation through published rounds, overlapping in-progress rounds and planned edits without a time gate. Real club polling pauses while the simulation is open; the sandbox polls only its own protected endpoint. Regular score operations never reload the real club history. Initialization and reset read real members once to create fresh snapshots.

## Tester access

The owner may grant or revoke a member's independent `simulationTester` capability through the audited `simulationAccess` command. Testers retain the `member` role and all existing real-club data visibility, event permissions and account restrictions. They gain no real points, rating, account, role, export or group-management authority. No display name or client-supplied role grants access.

The sandbox entry and route use the server-projected capability. Every sandbox read, initialization and mutation checks the stored account, and the conditional write rechecks admin/tester authorization. Revocation invalidates reads and writes immediately; ordinary member projection never exposes administrator account lists or audit history. Administrators and authorized testers share the same isolated sandbox with revision conflict protection. Specific grants are production account data and are never committed as public name or account-ID lists.
