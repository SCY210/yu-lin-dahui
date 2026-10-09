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

Account/role, month/year, revision, or time boundaries invalidate validators. Active-event data refreshes fully so participation time and round opportunities stay current. Exports always fetch fresh complete data.

## Voting behavior

Partner-mode voting defaults to open before selection/confirmation unless the creator explicitly closes it. Partner-mode and shuttle votes belong to the account's own enabled, confirmed participant. Waitlisted players cannot vote and old votes no longer count; promotion restores eligibility.

One account has one vote, can change/retract it before the start, and the creator confirms the selection. Tests cover default opening, explicit closure, waitlist rejection/promotion, and eligibility loss.

## Verification

Use npm test, npm run typecheck, and npm run build. tests/club-read-api.mjs isolates authentication/persistence to verify 304 avoidance, revision/query/role/user invalidation, 401/403, fresh exports, setup, and invalid inputs without production access.

Do not equate local gzip estimates with real network latency. Recheck image transparency/details, route behavior, and lazy loading after changes.
