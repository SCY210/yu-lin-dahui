# Elo-balanced doubles and profiles

Branch: `feature/balanced-match-grouping`.

Elo remains `doubles-elo-v1`: validated, completed Elo-enabled matches update
the existing rating from the administrator's initial estimate. Ranking points,
self-declared level, years played and gender do not influence Elo or grouping.
New players keep the neutral default; the existing provisional flag lasts for
the first ten rated matches. No historical ratings are migrated or recomputed
solely because of this change.

Fair-turn debt, availability, locked matches, arena holders and venue boundaries
still determine eligibility and who plays. Among eligible selections the
optimizer compares the worst and total average-Elo gap above a 40-point
tolerance, then partner/opponent variety. A 40-point gap means about 56/44
expected win probability under the existing Elo model; this is a preference,
not a guarantee. Each ordinary court checks all three pairings. A seeded local
search also exchanges players between compatible courts; it does not guarantee
a global optimum. Fixed partners stay together and use the same balance
priority when matching opposing teams. With unequal players, repeating a
partner can be necessary for a fair contest, including individual rotation.

The optional profile `gender` accepts `male`, `female`, `other`, `undisclosed`.
Old records show “不愿透露” without a migration; old clients omitting the field
preserve a saved choice. The choice is visible to authenticated club members
alongside the other profile fields. Existing ownership/admin editing rules apply.

Match and resting-player names/avatars open the existing full profile and
preserve navigation back to the activity. Draft position swaps use a separate
button; profile navigation remains available for published, playing and finished
matches and fixed partners.

Validation: `tests/match-grouping.test.ts` covers balance versus repetition,
multiple courts, deterministic variety, fixed teams, profile persistence and
permissions, and independence of Elo/grouping from profile declarations.

Verified on Node 24: all 415 unit tests and the existing API checks pass;
TypeScript and the production build pass. Browser checks cover opening a profile
from a draft match, all four gender options, saving a choice, and returning to
the same activity/round. Lint passes for the new components and grouping domain
files; repository-wide lint already reports existing `any` errors and generated
files from ignored local test folders.
