# Live referee scoring

Competition matches can be scored point by point on a referee's phone, and every court can be watched at once on an
iPad (`lib/domain/live-score.ts`, `app/referee-console.tsx`, `app/live-scoreboard.tsx`).

## Referees

The competition's creator, the owner and administrators assign a referee to each fixture (`tournamentReferee`). Any
enabled member with an account may referee a fixture they do not play in. Live scoring needs an assigned referee: the
referee button appears only then, and the server refuses live operations on a fixture without one. Until a referee is
assigned, organisers see a button to assign one, and the score can still be entered directly. Once assigned, the
referee, the creator, the owner and administrators can open the referee page. A court's referee carries over to the
next fixture the system starts on that court, unless they play in it.

## The referee page

- **Start.** The match clock starts with the start button. Points cannot be scored before it.
- **Points.** A tap on a side's score adds a point to that side. A double tap takes back that side's last point,
  including a point it received from a red card against the other side. Taps go out one at a time in order.
- **Pause.** The clock stops while paused, and no points can be scored. Resume continues the clock.
- **Break and change of ends.** When a side first reaches the midpoint of a game (11 of 21, 8 of 15, 6 of 11), a
  60-second break starts. A countdown dialog asks the players to change ends, and the referee page and the board swap
  the two sides by themselves (`breaks`, `currentBreak`, `sidesSwapped`). The referee can end the break early. There is
  no manual change-ends button.
- **Cards.** Each card shows its explanation before it is given, and may name one player of a doubles team. The last
  card can be withdrawn.
  - **Warning:** a spoken caution, no effect on the score.
  - **Yellow card:** a formal warning, no effect on the score.
  - **Red card:** a fault, and the opponents score a point.
  - **Black card:** disqualification. The opponents win the match.
- **End.** Games follow the rule of the match's stage (docs/TOURNAMENTS.md). The match ends when a side has won the
  majority of games, or at a black card. Five seconds later the result is submitted automatically as an ordinary match
  score, which updates standings, the bracket, the leaderboard and realm scores; a double tap before then takes the
  last point back and cancels it. After a black card, the opponents are recorded as winning the unfinished game with
  the fewest points that finish it, and any game they still needed at 21:0 (or 15:0, 11:0). The saved result is
  therefore always valid under the rule. After the result, the page offers the next match on the same court.
- **Errors.** Every error, here and anywhere in the app, opens a dialog that must be closed (`app/error-dialog.tsx`).
- **Rotation.** The score digits size themselves to their panel, so turning the phone and back never pushes them out.

## The board

The live board shows the draw sheet with matches in play highlighted, the group tables during the group stage, and one
card per match in play. Each card shows the teams with avatars, finished games, the current score, the match clock, the
midpoint break countdown with the change of ends, and every warning and card given in the match, with the player and
its effect. The sides follow each court's change of ends. A finished match leaves the board, whether the referee or
anyone else entered its score. The board refreshes every two seconds while visible and has a full-screen button for an
iPad.

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
