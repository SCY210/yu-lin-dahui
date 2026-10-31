# Ranking points breakdown

The top of each board shows the signed-in player's rank, points and board size,
with the selected quarter or year and singles/doubles format. **Locate me** scrolls
to and focuses their highlighted row in the full list. It respects reduced-motion
preferences and leaves room for the mobile navigation. The summary uses the
server-provided rank, including ties and zero-game players, without changing the
ranking rules or adding a request. Missing players see an unranked message;
loading another period hides stale ranks and the locating button. Accounts without
a linked player do not get a personal summary.

Every row of the quarterly and annual boards, singles and doubles, has a breakdown toggle under its total (`app/ranking-view.tsx`). It opens a panel across the row that lists where the points come from and a total line equal to the row's points. One panel is open at a time; tapping the toggle again closes it. The name and avatar still open the player profile.

The lines come from fields every leaderboard row already carries (`aggregateLeaderboard` in `lib/domain/ranking.ts`), so the breakdown adds nothing to the club payload. `pointsBreakdown` in `lib/client/ranking-breakdown.ts` builds them in this order:

- Won games times the win points and lost games times the loss points (`seasonPointsPolicy`).
- Upset bonus, winning-streak bonus.
- MVP points, bounty points, notification points, late deductions.
- Owner adjustments (`manualPoints`, doubles board only).

Only non-zero sources are listed, with signed values. If the known sources ever fail to explain the total, the remainder shows as one extra line, so the lines always add up to the total. When the row includes games of an activity still in progress, the panel notes how many and their points, which are confirmed when the activity ends.

Validation: `tests/ranking-breakdown.test.ts` checks on a fictional club that every row of the quarterly, annual and singles boards adds up with no unexplained remainder, including owner grants, streaks and upsets. `tests/ranking-breakdown-ui.mjs` covers the toggle, the panel, the in-progress note and the unchanged profile links. It also covers the personal summary across all four boards, tied and zero-game ranks, loading and absent players, the focus target and reduced-motion scrolling.
