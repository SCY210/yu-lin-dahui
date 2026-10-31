# Group and knockout tournaments

Use Create competition on Home or Activities. Live referee scoring and the all-courts board: docs/LIVE_SCORING.md. A competition is a distinct event
with the existing signups, venue bookings, time-based expenses and permissions.
It supports singles or fixed-pair doubles; practice and ordinary scheduling remain
separate and unchanged.

For the groups format the host selects formally registered players (up to 32 teams), assigns
doubles partners, chooses 2–8 groups and 1–4 qualifiers per group, then confirms a
seeded random draw. Every group has at least two teams. Groups play one round robin.
Standings sort by wins, total rally-point difference, rally points scored and the
published draw order for an exact tie. These rules appear before the draw.

The host starts each fixture on a free booked court, without entering match times.
Stored signup intervals, venue participation, enabled players and busy players and
physical courts are checked server-side. Scores use the existing validated score
entry, persistence, ranking and rating replay. Singles and doubles remain separate.

After all group matches have results, the host confirms the qualifying standings
and generates the full elimination bracket. Higher group places seed first;
first-round opponents cross groups when possible. Empty slots are explicit byes.
Future opponents resolve from preceding results, and the final winner is shown.

Redraws are allowed only before the first match. Group scores that would change the
qualifiers are sealed once the knockout is drawn; an entirely unstarted knockout bracket can be removed to correct them.
A correction cannot change a winner once the next dependent match has started.
Tournament fixtures cannot be voided through ordinary activity controls; this
initial release requires valid completed scores and does not implement withdrawals
or walkovers. No existing activities are converted and no production data is seeded.

Tournament metadata lives in the existing event JSON, with ordinary persisted
matches and rounds. No destructive database migration or parallel score store is
introduced. All tournament mutations require the persisted creator/admin authority.

## Formats, categories, scoring and entry fees

Before the draw, the owner and administrators choose the format, the category and the scoring rules
(`tournamentSettings`, audited; `app/tournament-settings.tsx`). Everyone sees the chosen settings on the competition
page. Creators who are not administrators can still draw and run the competition, but cannot change these settings.

- **Formats.** Groups then knockout (the original flow, and the format of every competition created before formats
  existed); a single knockout; or a single round robin of 2 to 16 teams in one table, whose top team is the champion.
  A knockout is seeded by team realm score: the page sends the teams strongest first, seeds 1 and 2 can only meet in the final
  and 1 to 4 in the semi-finals, and the top seeds take the byes (`seededFirstRound`).
- **Categories.** Singles (anyone), men's singles, men's doubles, or mixed doubles (one man and one woman per team).
  The create form asks for the category, and singles or doubles follows from it. Settings may switch only within
  singles (singles or men's singles) or within doubles (men's or mixed). Gender comes from the player profile, or a
  guest's gender. Men's categories list only men for the draw, the draw refuses a team that does not fit and names the
  players, and auto-balanced men's doubles pair men only. Doubles competitions created before categories have none and
  take anyone.
- **Scoring.** One game or best of three, to 21, 15 or 11 points. After deuce a side must lead by two, and the side that
  reaches the cap (30, 21 or 15) wins. The group stage (or round robin) and the knockout each have their own rule
  (`scoring` and `knockoutScoring`, `stageRule`), for example one game to 15 in the groups and best of three to 21 in
  the knockout. New competitions default to best of three to 21 for both. With a rule, score entry, referee scoring and
  the board follow the rule of the match's stage. Score entry asks for every game, rejects unfinished games, and
  replaces the club's own target and cap for these matches. Competitions without a rule keep the club rules, and a
  knockout without its own rule follows the group rule.
- **Partners.** Doubles partners are fixed for the whole competition. The auto-balance button pairs every confirmed
  entrant: the strongest with the weakest by realm score, then swaps members between teams while that brings the team
  totals closer (`lib/domain/tournament-pairing.ts`). Only an odd player out is left over. In mixed doubles, when there
  are more men than women, the men with the lowest realm score take the women's places (and the strongest women the
  men's places in the opposite case); mixed teams of two men or two women are accepted. Teams with a stand-in, and teams
  whose total is more than 150 from the average, are highlighted with the reason, recomputed while the owner or an
  administrator edits the pairs by hand (`pairingFlags`). Men's doubles pair men only.
- **Entry fee.** A competition is paid by a compulsory entry fee, never split. The fee is the competition's courts,
  its shuttles and other expenses, and the prize costs for champion, runner-up and third place, divided by the
  confirmed entrants and rounded up to a whole euro (`competitionCosts` and `entryFeeSettlement` in
  `lib/domain/money.ts`). The owner and administrators set the prize costs in the competition settings; the organiser
  records shuttles on the fee tab. What rounding up collects above the costs is recorded as the version's rounding
  difference. The fee tab (`app/tournament-fees.tsx`) shows only this breakdown, the fee, the confirmation, payment
  marks and the unpaid reminder; none of the activity split rules apply. The fee can be confirmed before the
  competition ends, and a change of entrants or costs asks for a new confirmation.

Tests: `tests/tournament-formats.test.ts`.

## Signup, scheduling and the competition page

- **Signup.** A competition has one signup for the whole event (`app/tournament-signup.tsx`). Entrants never pick a
  court or a time slot; when the field is full, later entrants wait in order. Organisers can sign members up and manage
  the courts below. Shuttle and partner options, activity details and bringing a friend are not offered. Court
  occupancy sits at the bottom of the signup tab of activities and competitions.
- **System scheduling.** Competitions created now have `autoArrange`. After the draw, after the knockout is generated
  and after every result, every free court booked at that moment takes a ready fixture (`arrangeFixtures`). Earlier
  rounds go first; within a round, the fixture whose players have played least and waited longest goes first, so
  everyone plays about as often. Nobody is put on two courts at once, and a court's referee stays on for its next
  fixture unless they play in it. Organisers can also run the arrangement by hand, or start a fixture on a chosen court.
- **Page layout.** Matches on court are pinned to the top of the competition page, with the referee button. Each group
  lists all its teams first, ranked with avatars and their record, and then its fixtures as compact rows. A fixture
  opens its own screen with start, referee and score controls, so closing it returns to the same place on the page.
  After a referee submits a result, the referee page offers the next match on the same court.

## Rules that keep the competition consistent

- **Title.** A competition's automatic title is its date and category, for example "October 31 · mixed doubles competition" in Chinese. It follows
  changes of time and category.
- **Field fixed at the draw.** After the draw, members can no longer sign up, and drawn players cannot withdraw
  themselves; the organisers withdraw them and record a walkover for their remaining matches.
- **Entry fee by players.** Before the draw the entry fee is shared by the confirmed signups; after it, by the drawn
  players only, so a signup left out of the draw does not pay. The fee tab shows who collects it (the activity's fee
  recipient, set there by the organisers).
- **Walkover.** For a match in play, organisers can record that one side withdrew. The other side wins every game it
  needs 21:0 (15:0 or 11:0), a valid result, so standings and the bracket move on (`walkoverGames`).
- **Players told where to play.** Whenever a competition match is put on a court, by the system or by hand, its
  players get a reminder and push with the court and opponents.
- **Who scores.** In a competition, scores come from the match's assigned referee and the organisers (creator, owner
  and administrators). Players cannot enter or correct their own scores, and are not prompted to.
- **Corrections.** A group score can still be corrected after the knockout is drawn, as long as the qualifiers and
  their order stay the same (`qualifiers`). A knockout winner cannot change once the next match has started.

## Bracket presentation

The knockout is a printed draw folded in two (`app/tournament-bracket.tsx`): the top half of the draw runs left to
right, the bottom half right to left, and both meet at the final in the middle, so the sheet is half as tall. Column
headers name the round each column plays next (1/8, quarter-finals, semi-finals, final), with the champion in the
middle. The outer columns list every entry with its draw number and seed (the seed number in a seeded knockout, the group and place after groups), byes included. Each column toward
the middle shows who went through, with the game scores under the line. A match in play
is highlighted: both teams' lines, the bracket joining them, and the place its winner will take, with the court.
Tapping a match opens it. The sheet scrolls sideways on a phone.

With `autoArrange`, the knockout is drawn by itself as soon as the last group result is in (`advanceAfterGroups`,
audited as the system), with group winners seeded first in standard seeding so the top two can only meet in the
final, and first-round opponents from different groups where possible. The system then starts it on free courts.

## Live board

The live board shows the draw sheet with its progress, the group tables during the group stage, and one card per
match in play. A finished match leaves the board, whether the referee or anyone else entered its score.

## Results and archive

Once the champion is known, the competition page shows the podium and every team's place and record: matches, wins,
losses, games and points (`tournamentResults` in `lib/domain/tournament-results.ts`). Places follow the format.

- **Knockout:** a team's place follows the round it went out in. The final loser is second, the semi-final losers share
  third, the quarter-final losers share fifth, and so on.
- **Groups then knockout:** teams that did not qualify follow, sharing a place with the other groups' teams of the same
  group place.
- **Round robin:** places keep the table order.

The creator, owner and administrators archive a finished competition with one click (`tournamentArchive`, audited).
The results are frozen with the players' names as they were, so later renames or edits never change a past
competition. The competition then appears under past competitions on the Activities page, newest first, with its
champion, and stays viewable at any time. An archived competition's draw and fixtures cannot change. Archiving can be
undone to make a correction, and the entry fee can still be adjusted.

Tests: `tests/tournament-results.test.ts`.
