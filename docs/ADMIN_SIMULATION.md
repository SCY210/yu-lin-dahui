# Administrator scheduling simulation

Live doubles use the same winner preference as production, without a consecutive-win limit. Waiting players remain eligible; scarce substitutes never cause an automatic two-win lockout. Saved legacy win-limit entries are ignored and omitted from normal responses. Four available players can continue, while voluntary rest and busy-player protections remain. Simulation changes never write the real club.

Rotating live matches share production's bounded partner-repetition cost: prefer new partners when strength is close, retain the balanced pairing for large differences, and preserve fixed-partner mode. No separate simulation-only pairing algorithm or win-limit is introduced.

Activities offers a small simulation button at the bottom of the page to the club owner, administrators and authorized member testers. The simulation page first asks which sandbox to open: an activity, or a competition (see Competition sandbox below). Every API request checks the authenticated account's stored role or independent tester capability; conditional writes check it again. Members without an explicit grant cannot access the sandbox. Testers also manage
ranking and scheduling for their own real activities; see [Tester ranked activities](TESTER_RANKED_EVENTS.md). Their member role and other administrator restrictions remain unchanged.

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

The document also keeps, server side only, which real member each sandbox player was copied from (`sources`). Every write reads the club and carries the current pairing odds of the next real activity onto those players, so simulated lineups follow the same odds as production ([Pairing odds](PAIRING_ODDS.md)); the simulation view never includes them.

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

## Competition sandbox

The competition sandbox debugs a competition end to end without opening a real one (`lib/competition-simulation.ts`).
It follows the real flow and runs it on the real pages:

1. **Create.** The sandbox starts with a snapshot of every enabled member with an account, the same members who can
   sign up for a real competition, taken with the same rules as the activity
   sandbox, and no competition. The organiser creates it with the real create form: category, time, venue and courts.
2. **Sign up.** Members sign up through the same court signup as the real page. The sandbox can sign up or cancel any
   member, or sign everyone up at once.
3. **Run.** The real activity page takes over: signups, the competition tab (settings, draw, fixtures, referees,
   referee scoring, knockout, results and archive) and the fee tab (entry fee confirmation and payment marks).

A competition is created for tomorrow, as in the real form. "Move to the start" shifts the whole competition, with its
courts and signups, so it starts now. Only one competition exists at a time; reset clears it and refreshes the member
snapshots.

It is a separate settings row (`admin-simulation-competition-v1`), behind the same access checks, revisions and request
receipts as the activity sandbox. Requests name it with `kind: 'competition'` (`GET /api/simulation?kind=competition`).
Its document keeps its progress until it is reset. Only competition creation, signups, fees and the activity commands
run inside it, never club-wide commands.

Two shortcuts make the flow quick:

- **Start ready fixtures** puts the next ready fixtures on every free court.
- **Finish matches in play** records a random result for every match in play. The result follows the rule of that
  match's stage, and the stronger side by realm score wins more often. A match the referee finished live keeps the
  referee's score.

Live referee scoring keeps its point log inside the sandbox document instead of the `live_scores` table. The referee
page and the board use the same components through the scheduling context (`ctx.live`). Nothing reaches the real
club, live scores, rankings, fees or notifications.

Tests: `tests/competition-simulation.test.ts` runs the full flow from the create form to the archive.
`tests/admin-simulation-api.mjs` covers the competition kind, and `tests/admin-simulation-ui.mjs` the chooser.
