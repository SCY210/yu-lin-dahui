# Standalone Cloudflare deployment

The existing Sites project keeps its logical storage bindings and publication
workflow. A standalone Worker uses `wrangler.cloudflare.json`, which contains
the selected D1 database ID, the existing R2 bucket name and the Worker name.
These resource identifiers are configuration, not credentials. Never add an
API token, password, session or production data to this file.

## Workers Builds

Keep the existing build and deploy commands:

```sh
npm run build
npx wrangler deploy
```

Cloudflare injects `WORKERS_CI=1` into Workers Builds. Production builds with
that marker select the standalone configuration automatically. The Vite plugin
generates `dist/server/wrangler.json` and Wrangler's deployment redirect, so the
deploy command uses the actual D1 ID rather than the local placeholder.

For a manual standalone build, set `YULIN_DEPLOY_TARGET=cloudflare` in the build
process environment and run the same commands. An explicit value of `sites`
selects the existing Sites build even if a Workers CI marker is present.
Local development always retains its original local bindings and persistence.

## Database and uploaded files

Provision the selected database and enable R2 in the destination account before
deployment. Use the R2 bucket named in the configuration; it stays private.
Worker deployment does not copy the original Sites database or uploaded images.

For a **new, empty database only**, initialize the schema with the project's
journaled SQL migrations:

```sh
npx wrangler d1 migrations apply DB --remote --config wrangler.cloudflare.json
```

For a database that already contains real data, first audit its schema and
migration history and preserve a recovery point. Do not replay all migrations
over an imported database. A complete migration also requires the account and
credential records and the corresponding R2 objects; the club JSON export is
not a complete database backup. See [Operations and recovery](OPERATIONS.md).

A new database has no production administrator or password account. Account
provisioning or a verified import must be completed before normal login works.
The deployment configuration does not create a public initialization endpoint
or seed a password.

## Authentication boundary

The standalone configuration sets `YULIN_HOSTING_PROVIDER=cloudflare`. Its
Worker entrypoint removes visitor-supplied `oai-authenticated-user-*` headers
before application handlers execute, because standalone Cloudflare has no Sites
identity-distribution layer. Existing password-session cookies remain intact.
Keep this variable in standalone deployments. Original Sites requests retain
their platform-provided identity and existing access policy.

Deployment success, database initialization, data migration and application
acceptance are separate checks. Verify login, membership permissions, activity
registration, scores, fees and private image access before switching visitors.
