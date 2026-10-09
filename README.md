Engineering verification and modernization: [ENGINEERING.md](docs/ENGINEERING.md). Incident response and recovery: [OPERATIONS.md](docs/OPERATIONS.md). Use the Node version in `.node-version`, install with `npm ci`, then run `npm run verify`. The lint gate permits only decreasing historical debt; `npm run lint:report` shows the outstanding findings.

# Yu Lin Da Hui

A private, mobile-first badminton club web application. The existing UI is in Chinese; shared development documentation is in English. Defaults: EUR and Europe/Madrid.

Canonical source: [SCY210/yu-lin-dahui](https://github.com/SCY210/yu-lin-dahui). Hosting uses the existing Sites project with Cloudflare D1 for structured data and R2 for photos. GitHub contains source, not production data, passwords, sessions, uploads, or local runtime state.

See [collaboration and checkout hygiene](docs/REPOSITORY_HYGIENE.md), [security](docs/SECURITY.md), and [privacy and legal readiness](docs/LEGAL_READINESS.md). Collaborators submit PRs for SCY210's review.

## Current application flows

Live court rotation advances each court after a recorded score, prioritizes fewer appearances, and honors a one-game break without manual match time inputs. Default avatars, partner voting, owner point adjustments, the realm rating (a long-term Elo-style score that sets the visible realm; grouping replays the same formula over doubles games only; reset only after three months without rated games), season points for the quarterly and annual boards (3 per win, minus 1 per loss, plus an upset bonus) and a singles leaderboard are available. Proxy guest profiles keep their game history but stay outside the global rankings until assigned their own account.

## Local setup

On Windows, double-click start-local-test.cmd to run this checkout against an isolated local branch database. It never uses production data. See [the local test launcher](docs/LOCAL_TEST_LAUNCHER.md).


Requires Node.js >=22.13.0. Use a supported Node executable in your own environment; do not copy another developer's absolute runtime paths.

```powershell
npm ci --no-audit --no-fund
npm run build
```

Initialize a new local database by applying the SQL migrations in the order recorded in drizzle/meta/_journal.json. For example:

```powershell
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_handy_freak.sql
```

Repeat for each later migration, including 0007_security_limits.sql. For an existing database, apply only unapplied migrations. Never replay historical migrations or reset a database containing real data.

```powershell
npm run dev
```

Open the address reported by the server (normally http://127.0.0.1:5173). Local data persists in .wrangler/state across refreshes and restarts and is separate from production D1.

The development preview provides a fictional identity only on loopback. Production builds exclude that mock. Keep development and test servers bound to 127.0.0.1. Production must remain behind the Sites identity distribution layer; never expose a Worker that trusts forwarded identity headers directly.

## Accounts and permissions

Members sign in using administrator-created usernames and passwords; email and public self-registration are not required. New usernames use 2-32 ASCII letters/digits, with case normalization. Legacy usernames remain compatible. Existing platform identities can enable password login while retaining their original account, profile, and permissions.

A member may change their own username once after verifying their current password. The club owner can change usernames repeatedly and manage roles. Other administrators cannot modify the protected owner account or profile. Password changes/reset revoke the appropriate old sessions. There is no default administrator password or test backdoor. See [account management](docs/ACCOUNT_LOGIN.md).

The login entry is public; club data, photos, events, scores, and costs require server-side authentication and membership. The invitation hash is retained for compatibility and stored as SHA-256, but production does not use it for open enrollment.

## Main workflow

1. An administrator creates an event, signup deadlines, capacity, and one or more court bookings. Noncontiguous booking periods are supported.
2. Each participant has a separate profile and registration. Full events create a waitlist; cancellation promotes the first eligible waiting participant. Cancellation within 24 hours of the start requires a manager's approval.
3. Confirmed registrations default to participation without mandatory check-in. Actual participation intervals determine court planning and cost sharing; future time is not treated as completed attendance.
4. Generate a round draft, inspect rest opportunities, swap players/courts, lock selected matches, and publish. Regeneration preserves locked matches.
5. Start the round; every complete website match counts toward season points and the realm rating. Record a legal final score (for example, 21:15) or best-of-three result. Correcting scores rebuilds points and replays later ratings.
6. Record actual shuttle usage per ball: model, price per ball, and ball count (convert whole tubes to balls, e.g. one 12-ball tube plus 4 balls = 16), optionally with a consumption interval. Legacy per-tube records still load and settle with unchanged amounts (see docs/UPDATE_FEES.md). Record other costs and choose independent court and shuttle split modes.
7. Configure item exemptions and club subsidies. Each result reconciles participant charges, subsidies, and unallocated costs. Unallocatable costs require explicit handling before final settlement.
8. Save or confirm a settlement version. All club members can view participant shares and details. Corrections create a new version; previous versions remain available.
9. Administrators can export complete business data and audit records. Treat exports as personal data and keep them outside Git.

The app displays how much each person owes for the shared activity. Payment confirmation, paid/unpaid status, refunds, payment collection, and debt tracking are not implemented. Historical payment records remain in storage for compatibility but are not created or exposed by normal business APIs.

## Data and algorithms

Business records use separate relational tables with JSON payloads for detailed fields. Foreign keys, unique registration/version indexes, and unique commit revisions protect relationships and concurrent writes. Credentials, sessions, and rate limits are separate from business exports.

Writes use atomic D1 batches with a unique revision and idempotency key. Registration conflicts reload state and recompute, with up to five attempts. Administrative writes require the current revision and return 409 when stale. Every API validates identity, role, ownership, and same-origin write requests. Ordinary members cannot access private drafts and their related records.

- lib/domain/commands.ts implements registration order, promotion, permissions, validation, and state transitions.
- lib/domain/grouping.ts selects by opportunity deficit and waiting time, then runs 600 seeded local-search iterations to balance strength and repeated pairings. Matches require a valid booking that covers their duration. This is a heuristic, not a global-optimum guarantee.
- lib/domain/money.ts supports equal, duration, and interval splits. BigInt rational arithmetic and deterministic largest-remainder allocation reconcile cents. Item totals are fixed in cents before allocation: new shuttle records (price per ball × count) are already whole cents, while hourly costs and legacy per-tube shuttle records round half-up. Estimated shuttle intervals are marked when precise consumption times are absent.
- lib/domain/ranking.ts treats matches as the factual source. Leaderboard points are the season points of each rated game in the period by Madrid start month (lib/domain/season-points.ts), plus owner point adjustments on the combined board (see docs/REALM_PROGRESSION.md). All enabled players appear without a minimum-game threshold. Ties use points, win rate, and average point difference. The realm rating replays by completion time and ID; each game's changes sum to zero when both sides use the same K. The first ten rated games are placement games.


Stored per-month win/loss/cap values stay readable but no longer affect points; realms settle after each activity ends. The realm rating starts at 1000 (K=32 for the first 20 games, then 16); target=21, lead=2 and ceiling=30. Rules are bound to a month; default updates do not rewrite historical months. Historical changes require preview and explicit confirmation and retain an audit trail.

## Verification

```powershell
npm test
npm run typecheck
npm run build
```

Reproducible tests remain in tests/. Generated reports belong in .test-output; historical per-checkout Markdown reports are no longer shared. Exact results belong to the PR that performed the run, not a claim that every checkout has been tested.

HTTP suites require dedicated fictional loopback databases. Apply all migrations there, then start an isolated built Worker:

```powershell
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js dev --config dist/server/wrangler.json --local --persist-to .test-output/api-state --ip 127.0.0.1 --port 8787 --inspector-port 0
```

Follow each test script's fixture requirements. tests/reset-local-test.sql destroys all data in its target and is only for an empty, dedicated fictional test environment. Never run it against production or a real local database. Local identity headers are test infrastructure, not a production login method.

The read-only request-body HTTP regression uses port 8794 by default and requires no account setup or migrations: node tests/request-body-http.mjs. See [security](docs/SECURITY.md) for timing and emulator limitations.

## Deployment

.openai/hosting.json identifies the shared existing Sites project and logical DB/BUCKET bindings. It is required deployment configuration, not a personal Codex profile. The Sites build plugin produces a Cloudflare Worker ESM bundle and includes Drizzle migrations. Deploy only the supported build artifacts, hosting metadata, and migrations; exclude local state and credentials.

Source synchronization to GitHub does not deploy a Site. Follow the authorized Sites hosting workflow and verify its successful receipt. Do not alter audiences, collaborator protections, identities, or production data incidentally.

Complete the real operator information and privacy decisions in [legal readiness](docs/LEGAL_READINESS.md) before publishing the new notices. This repository does not certify legal compliance.

## Feature documentation

- [Activity flow](docs/ACTIVITY_UI.md)
- [Social features and game modes](docs/SOCIAL_FEATURES.md)
- [Player pages](docs/PLAYER_PAGES.md) and [profiles/equipment](docs/PLAYER_PROFILES.md)
- [Ranking](docs/RANKING.md), [singles ranking](docs/SINGLES_RANKING.md), [realm rating and realms](docs/REALM_PROGRESSION.md) and [podium](docs/RANKING_PODIUM.md)
- [Cost sharing](docs/UPDATE_FEES.md)
- [Venues and map links](docs/VENUES.md)
- [Feature guides](docs/FEATURE_GUIDES.md)
- [Mobile navigation](docs/MOBILE_BACK_NAVIGATION.md)
- [Installing the PWA](docs/INSTALL_APP.md)
- [Performance architecture](docs/PERFORMANCE_SLIMMING.md)
- [Visual assets and provenance](docs/VISUAL_ASSETS.md)

Known boundaries: rescheduling a whole event does not automatically update all dependent records; individual bookings and supported event fields can be edited. Chat, payments, inventory, and a multi-club platform are outside scope. Cost forms support two time-adjusted shuttle intervals at once; additional records can represent more intervals. Large historical datasets still need further pagination. Automated checks are not a substitute for real-device, production-access, or load testing.

Activity creation supports Singles and Doubles with automatically generated date-based names and separate ranking boards. Modification forms use automatic audit descriptions instead of mandatory notes; see [Singles and doubles activities](docs/SINGLES_RANKING.md).
