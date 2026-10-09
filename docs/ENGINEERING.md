# Engineering quality and modernization

This project remains TypeScript, React and Cloudflare D1. The modernization
branch starts from the existing application so that current functionality and
historical records remain available. GitHub is the source mirror; this workflow
does not publish a Sites release or change production data.

## Reproducible verification

Use the Node version in `.node-version` / `.nvmrc` (24.19.0). The supported
minimum is 22.13; older Node versions fail before SQLite tests begin.

```sh
npm ci
npm run verify
```

`verify` runs shared-source privacy and repository policy checks, TypeScript, the lint regression gate, migration history checks,
unit and isolated integration tests, and a production build. Each subprocess has
a timeout and a failure stops the sequence. GitHub runs this on Windows and
Linux for feature branches, main, and pull requests, with read-only permissions.
Configure the two `Verify` jobs as required repository checks when adopting the
workflow; merely committing a workflow does not enforce branch protection.

Useful individual commands:

| Command | Scope |
| --- | --- |
| `npm run typecheck` | TypeScript across the project |
| `npm run lint` | Reject new or changed lint findings |
| `npm run lint:report` | Show all outstanding lint findings; currently nonzero |
| `npm run lint:prune` | Remove fixed findings from the accepted ledger; cannot add debt |
| `npm run test:unit` | Automatically discover every `tests/*.test.ts` file |
| `npm run test:integration` | Isolated handlers, real SQLite and WebCrypto |
| `npm run db:check` | Journal ordering and immutable historical SQL |

The initial lint baseline records existing debt by file, rule, severity and
source fingerprint. Rules are enabled. Changing affected code requires fixing
its findings; inserting another copy of an existing finding is also rejected.
Subsequent PRs cannot enlarge the baseline against their base branch. This is
an incremental migration mechanism, **not a clean lint report**. Remove the
baseline once the remaining UI and test debt is fixed.

Historical SQL hashes normalize line endings so Windows and Linux agree. New
schema changes must append a journaled migration. PR checks also compare every
migration already present on the base branch. No migration is run against
production by this workflow.

## Boundaries implemented in this delivery

- Seven business command modules preserve the relationship between action and
  schema-validated payload through discriminated unions. No business handler
  needs an untyped payload escape hatch.
- Club response types derive from the server projection, not the private State.
  Keep credentials, storage keys and inaccessible records outside that boundary.
- The auth entry validates an object before reading its action. Null, arrays and
  unsupported actions are client errors rather than accidental server failures.
- Login/binding response handling rejects HTML proxy errors, broken JSON and
  unexpected success bodies, using `unknown` at the network boundary.
- Persisted JSON passes an object/identity check. Corrupt storage produces a
  generic server error rather than leaking contents or blaming the client.
  This is not yet full schema validation of every historical record field.
- Browser history and photo deletion audit records are checked before use.
- Server errors have a request identifier. The Worker logs structured API
  route, method, status and duration records; IDs in photo URLs, query strings,
  cookies, passwords, account IDs and error messages are omitted.

Integration tests use an in-memory SQLite database with all journaled migrations
and foreign keys enabled. They execute real auth and business handlers, real
password hashes, hashed session lookup, rate limiting and transaction rollback.
Per-request cookie contexts remain separate during concurrent tests. The suite
covers last-place signup, promotion, idempotence, member permissions, stale
revisions, password-reset revocation, logout and corrupt storage.

These tests do not prove remote Worker scheduling, edge IP trust, browser
rendering, throughput, or production recovery. Older standalone API scripts
requiring an already-running Worker remain separate; some encode superseded
attendance or scoring rules and need updating before being added to CI.

## Remaining project-wide work

The first delivery was reconciled with shared `main` commit `9f3b5d3`, preserving
its current scoring, live-play, expenses, image rights, sharing and privacy
features. Local files retired by that version were copied to an ignored backup
before updating the checkout. A locked installation, 577 unit tests, all 17
integration suites, TypeScript, migration checks and the production build pass
locally. GitHub execution is reported separately when the branch is pushed.
During review, the initial lint ledger was aligned with current main after PRs 18, 17, 16 and 15. The reviewed branch has 388 findings versus 421 on that main revision; no file/rule/severity group increases. The initial ledger records this already-existing debt; subsequent ledgers may only shrink. The combined fixtures use the current Elo migration marker and current ranking expectations, while preserving the independent concurrency-winner assertions.

The scoring integration race accepts either legitimate winner, verifies that
only that score commits, then checks correction independently; it does not
assume concurrent requests finish in submission order.

| Stage | Concrete completion criteria |
| --- | --- |
| Client contracts and UI | Replace remaining component `any` types with view models; fix React findings without suppressing rules; strict lint report passes |
| Browser acceptance | Automate login → signup → match → score → expense allocation, mobile navigation and account changes against an isolated Worker |
| Persistence | Load the required activity/period/page rather than all history; retain full historical correctness for ranking and financial calculations; benchmark read counts and latency |
| Concurrency | Replace the global revision bottleneck only after introducing aggregate-level conflict checks and atomic invariants with race tests |
| Data evolution | Move the remaining request-triggered upgrades into explicit, repeatable migrations; validate all persisted record versions |
| Operations | Verify available Sites/D1/R2 access, configure error/latency alerts, and complete a restore drill including database and image objects |
| Deployment | Separate staging and production; associate a Sites release with its Git commit; verify rollback and backward-compatible migrations |

Do not call the entire application industrial-ready until these criteria are
met. Keep changes incremental and preserve tests of monetary conservation,
historical ranking replay, permissions, and last-place concurrency throughout.
