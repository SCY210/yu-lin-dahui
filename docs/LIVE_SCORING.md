# Live referee scoring

Competition matches can be scored point by point on a referee's phone, and every court can be watched at once on an
iPad (`lib/domain/live-score.ts`, `app/referee-console.tsx`, `app/live-scoreboard.tsx`).

## Referees

The competition's creator, the owner and administrators assign a referee to each fixture (`tournamentReferee`). Any
enabled member with an account may referee a fixture they do not play in. The assigned referee, the creator, the owner
and administrators can open the referee page once the fixture has been started on a court. The referee may also submit
that match's final score, even without a signup of their own.

## The referee page

- **Start.** The match clock starts with the start button. Points cannot be scored before it.
- **Points.** A tap on a side's score adds a point to that side. A double tap takes back that side's last point,
  including a point it received from a red card against the other side. Taps go out one at a time in order.
- **Pause.** The clock stops while paused, and no points can be scored. Resume continues the clock.
- **Change ends.** Swaps the two sides on the referee page and on the board, so names and scores sit where the
  players stand. The page prompts for the interval at 11 in a game to 21, and for changing ends at the midpoint of the
  deciding game.
- **Cards.** Each card shows its explanation before it is given, and may name one player of a doubles team. The last
  card can be withdrawn.
  - **Warning:** a spoken caution, no effect on the score.
  - **Yellow card:** a formal warning, no effect on the score.
  - **Red card:** a fault, and the opponents score a point.
  - **Black card:** disqualification. The opponents win the match.
- **End.** Games follow the competition's scoring rule (docs/TOURNAMENTS.md). The match ends when a side has won the
  majority of games, or at a black card. An undo reopens it. The referee then submits the result once, as an ordinary
  match score, which updates standings, the bracket, the leaderboard and realm scores. After a black card, the
  opponents are recorded as winning the unfinished game with the fewest points that finish it, and any game they still
  needed at 21:0 (or 15:0, 11:0). The saved result is therefore always valid under the rule.

## The board

The live board button on the competition page shows every court with a started or recently finished match: the team names,
finished games, the current game score and the match clock. It follows each court's change of ends, refreshes every
two seconds while visible, and has a full-screen button for an iPad.

## Storage and cost

Live state is a log of points and cards in its own table, `live_scores` (migration 0017), with one row per match. Games, winner,
prompts and the saved result are derived from the log, so an undo never leaves a stored total behind. A tap
(`POST /api/live-score`) reads only its match, its activity and its live row, and writes the row with a version check.
Taps from two devices that collide are retried against the newest row, so none is lost. The board
(`GET /api/live-score?eventId=`) reads only that competition's live rows. Neither touches the club snapshot, so a busy
competition stays within the Worker CPU budget (docs/PERFORMANCE_BUDGET.md). Signed-in, enabled members may read the
board; writes need the origin and JSON checks of every write and are rate limited per account.

Tests: `tests/live-score.test.ts` (rules, undo, cards, results, referee permissions) and `tests/live-score-api.mjs`
(permissions, concurrent taps, single-row reads and writes on SQLite).
