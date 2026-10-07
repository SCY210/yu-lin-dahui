# Windows local test launcher

Double-click **start-local-test.cmd** in the repository root. The launcher prepares dependencies and local migrations, starts the current checkout, and opens the full application at http://127.0.0.1:5190. Keep its terminal window open while testing; press Ctrl+C to stop. No terminal commands are required.

The checked-out Git branch determines the environment. Uncommitted changes are included. The launcher never checks out, pulls, or updates a branch. Each branch must contain the launcher and its supporting configuration; merge them into the shared base before using this workflow on other branches.

## Data for each branch

Each branch has its own persistent fictional D1 database and R2 storage under `.sites-runtime/local-test/branches/<branch-hash>/state`. Returning to a branch reuses its data. Case-sensitive branch names are distinct; a detached checkout uses its commit hash. Downloaded runtimes and package caches are shared within the checkout. Earlier prototype data under `.sites-runtime/local-test/state` is preserved without being reused or migrated.

A fresh database starts with only a fictional administrator named `Local test administrator`. There are no seeded activities, matches, or feature-specific records. Create whatever data your test needs through the application; later launches preserve your changes and deletions. No credentials or production data are imported.

The browser opens a test-only loopback login route that clears stale application session cookies before invoking the existing fictional sign-in helper. This lets the same browser move between branches whose accounts differ. The route is registered only for explicit local test serve mode and rejects non-loopback or cross-site requests.

## Automatic preparation

The launcher selects a compatible installed Node runtime and npm, including a bundled Codex runtime when available. If none is available, it downloads the official Node 24 Windows portable archive from nodejs.org, checks its SHA-256 against the official manifest, and extracts it under this checkout. No system-wide Node installation or administrator rights are required. The PowerShell execution-policy override applies only to this launcher's process.

Required npm dependencies are checked against the current branch's committed lockfile and installed if missing or outdated. Journaled Drizzle migrations are applied with Wrangler's local migration ledger. Successfully applied migrations are not repeated. Changed historical migrations produce an error instead of changing existing data. Migration history is isolated by branch. No database is reset or deleted.

Generated configuration, runtimes, caches, migration metadata, and process-control files stay ignored. The environment is independent of `.wrangler/state` and production. Vite overrides require both `YULIN_LOCAL_TEST=1` and serve mode; production builds keep their normal bindings.

## Switching branches and stopping

Stop the terminal before changing branches, then double-click **start-local-test.cmd** again. The launcher also monitors the Git branch and stops its server when the branch changes, so the running server cannot continue using another branch's saved data. Source edits and commits on the same branch remain available through the development server.

Only one launcher instance runs per checkout. A second launch on the same branch opens the running environment. Port 5190 supports one checkout or worktree at a time on the same computer; an unrelated process using that port causes a clear error without modifying that process.

## Verification

For automated verification, `scripts/start-local-test.ps1 -NoBrowser -SmokeTest` prepares the environment, starts the real application, checks initialization, saves a branch-local summary, and stops its own server tree. Running it twice verifies migration and data reuse. Unit tests cover branch isolation, dependency mismatches, migration changes, administrator initialization, preservation of user-created records, and local login restrictions.
