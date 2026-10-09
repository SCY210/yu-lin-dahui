# Singles leaderboard

The ranking page adds a Combined / Singles selector below the Quarterly / Annual selector. Both selections work together with the period picker, detailed statistics, points explanation and podium. On mobile the format selector takes a full row with equal-width buttons and follows the active theme. Returning from a player profile restores period and format; legacy history markers default to Combined.

## Eligible matches

Singles requires exactly one distinct player per side (`isSinglesMatch`: one ID in each side, with different IDs). No match fields are added.

The current match creation flows still generate doubles: live courts, scheduled points matches, fixed partners and grouping validation all use four players and two per side. This change does not add singles match creation. When no singles records exist, the singles board is empty and explains that the website currently arranges doubles. Future recorded singles matches appear automatically.

## Calculation

- Points are the sum of the selected period's rated singles-game realm-rating changes. Singles and doubles share one visible realm rating; see [REALM_PROGRESSION.md](REALM_PROGRESSION.md). Madrid start month determines the period. Best-of-three matches count each game. Quarterly and annual totals aggregate the relevant months. Legacy win/loss amounts and monthly caps no longer calculate ranking points.
- Sort by points, rated win rate and average score margin. Identical rows share a rank and subsequent ranks skip the tied positions.
- Only enabled players with their own account qualify. Proxy guest profiles and disabled players do not appear. A singles row additionally requires at least one completed singles match in the period.
- Owner point adjustments apply only to Combined, preventing duplicate attribution to Singles.
- Points update immediately after scoring. Visible realms and realm ratings settle when the activity ends by clock, ends early, or is cancelled; they stay fixed during play, with pending results indicated.

## Combined board and matchmaking

Combined continues to include every recorded website match, including singles, rather than becoming doubles-only.

Hidden `doubles-elo-v1` matchmaking strength applies only to two-versus-two matches using team averages. Replay skips singles and other team sizes, avoiding missing-teammate errors without changing existing doubles results. Visible realm ratings calculate singles using standard one-versus-one Elo.

## API and navigation

Authenticated club data adds `singlesQuarterlyLeaderboard` and `singlesAnnualLeaderboard`, using the same quarter/year as the combined arrays, so conditional-read cache scope is unchanged. Members still cannot obtain raw matchmaking ratings. Domain functions are `singlesLeaderboard`, `singlesQuarterlyLeaderboard` and `singlesAnnualLeaderboard`. Browser history preserves the selected format.

## Verification

`tests/singles-ranking.test.ts`, registered in `scripts/test.mjs`, covers recognition and empty states; mixed singles/doubles rating points, best-of-three games, wins, margins and ranks; Combined including both formats; removal of legacy monthly caps; Madrid quarter boundaries and aggregate totals; proxy/disabled players and invalid, unfinished or void results; exclusion of owner grants; unchanged hidden doubles strength; projection privacy; navigation restoration; immediate points and activity-end realm settlement.
