# Performance architecture

Scope: Tailwind source scanning, compressed decorations, lazy pages/dialogs, and conditional club reads. These optimizations retain business behavior, database structure, permissions, and fee/ranking rules.

## Frontend

Tailwind scans app/lib, root components, and the explicitly used UI components. New pages are included automatically; add additional UI components to the explicit source list in globals.css when necessary.

Activity details, social views, rankings, fees, galleries, player profiles, account management, scoring, account dialogs, and guide bodies load in separate chunks. Closed dialogs/forms are not eagerly fetched. Avatar rendering and field metadata stay lightweight.

Clients import small voting/time helpers. Zod validation and grouping stay server-side; original exported entry points remain compatible with tests/server consumers.

Two large decorative PNGs remain test/source fixtures. Pages use small WebP copies: the original combined 2,227,114 bytes became 87,402 bytes. Exact build measurements are historical observations, not guarantees of current bundle size or browser latency.

## Conditional reads

Every conditional GET still authenticates and checks current revision, settings, and account permissions. A matching bounded validator returns 304 without loading all eighteen business collections or recomputing projections.

The cache stores bounded validation metadata, not reusable cross-account response bodies. A cold or different Worker falls back to a full read.

Account/role, month/year, revision, or time boundaries invalidate validators. During a running activity a validator lasts until the next live clock boundary and 15 seconds at most; see [Worker CPU budget](PERFORMANCE_BUDGET.md#live-conditional-reads). Activities with legacy check-in attendance still refresh fully. Exports always fetch fresh complete data.

## Voting behavior

Partner-mode voting defaults to open before selection/confirmation unless the creator explicitly closes it. Partner-mode and shuttle votes belong to the account's own enabled, confirmed participant. Waitlisted players cannot vote and old votes no longer count; promotion restores eligibility.

One account has one vote, can change/retract it before the start, and the creator confirms the selection. Tests cover default opening, explicit closure, waitlist rejection/promotion, and eligibility loss.

## History and refresh work

Bond replay builds the guest set and indexes completed matches and gift rows once.
Read projections share the derived bond history per stored revision through the
existing bounded cache and validity window. Member rows and administrative pairs
are replayed only on first demand, avoiding extra work on a cold member read.
Each viewer still receives only
their own rows; owner/administrator access to pair rankings is checked on every
projection. Returned rows are independent copies. Gift notices, acknowledgement,
cancelled gifts and legacy asymmetric gift records keep their existing behavior.
Commands and other callers without a stored-revision read context compute fresh
results. No new clock-dependent behavior or persistence format is introduced.

Visible social statistics aggregate attendance and registrations once instead of
searching the whole activity history per player. Arena and court statistics use
completed matches indexed by visible activity. These request-local indexes retain
the caller's visibility filters, earliest manual arrival rules, per-court signup
semantics and match ordering.

The client reuses date formatters in a bounded 32-entry cache and one EUR currency
formatter. Chinese formatting, Madrid daylight-saving transitions and explicit
format options are preserved. Historical activity cards, live rosters and match
history pass render callbacks to `Disclosure`, so collapsed sections skip row
calculations as well as DOM mounting. Reopening uses the current response.

Reproduce the paired local measurements with Node from `.node-version`:

```sh
node tests/application-performance-benchmark.mjs
node scripts/benchmark-client.mjs
```

The application benchmark loads the complete baseline source tree from commit
`b2624dea039d5cc740f82232c209cd7c23fd9eaa` through Git, so that commit must be
available locally. It requires the same dependency lockfile and compares full
responses for an owner, member and draft creator, live and ended activities,
full and activity scope, and cold and shared results. All records are fictional;
reports go to ignored `.test-output/`. Timings measure local JavaScript work,
not network latency or deployed Cloudflare CPU. See
[the Worker budget](PERFORMANCE_BUDGET.md) for production limits and existing
clock-boundary tests.

## Verification

Use npm test, npm run typecheck, and npm run build. tests/club-read-api.mjs isolates authentication/persistence to verify 304 avoidance, revision/query/role/user invalidation, 401/403, fresh exports, setup, and invalid inputs without production access.

Do not equate local gzip estimates with real network latency. Recheck image transparency/details, route behavior, and lazy loading after changes.
