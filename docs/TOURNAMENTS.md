# Group and knockout tournaments

Use Create competition on Home or Activities. A competition is a distinct event
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

Redraws are allowed only before the first match. Group scores are sealed after
qualifying; an entirely unstarted knockout bracket can be removed to correct them.
A correction cannot change a winner once the next dependent match has started.
Tournament fixtures cannot be voided through ordinary activity controls; this
initial release requires valid completed scores and does not implement withdrawals
or walkovers. No existing activities are converted and no production data is seeded.

Tournament metadata lives in the existing event JSON, with ordinary persisted
matches and rounds. No destructive database migration or parallel score store is
introduced. All tournament mutations require the persisted creator/admin authority.

## Formats, categories, scoring and entry fees

Before the draw, the owner and administrators choose the format, the doubles category and the scoring rule
(`tournamentSettings`, audited; `app/tournament-settings.tsx`). Everyone sees the chosen settings on the competition
page. Creators who are not administrators can still draw and run the competition, but cannot change these settings.

- **Formats.** Groups then knockout (the original flow, and the format of every competition created before formats
  existed); a single knockout; or a single round robin of 2 to 16 teams in one table, whose top team is the champion.
  A knockout is seeded by team realm score: the page sends the teams strongest first, seeds 1 and 2 can only meet in the final
  and 1 to 4 in the semi-finals, and the top seeds take the byes (`seededFirstRound`).
- **Categories.** Singles, or doubles for men only or mixed (one man and one woman per team). Gender comes from the
  player profile, or a guest's gender. The draw refuses a team that does not fit and names the players; unset doubles
  take anyone.
- **Scoring.** One game or best of three, to 21, 15 or 11 points. After deuce a side must lead by two, and the side that
  reaches the cap (30, 21 or 15) wins. New competitions default to best of three to 21. With a rule, score entry asks
  for every game, rejects unfinished games and replaces the club's own target and cap for these matches. Competitions
  without a rule keep the club rules.
- **Partners.** Doubles partners are fixed for the whole competition. The auto-balance button pairs the strongest with the
  weakest by realm score, then swaps members between teams while that brings the team totals closer
  (`lib/domain/tournament-pairing.ts`). Mixed doubles only swap within a gender. Players left without a partner are
  listed. The organisers can edit every pair before the draw, or assign all pairs by hand.
- **Entry fee.** When the owner or an administrator sets a fee per player, the fee settlement no longer splits courts
  and shuttles. Every confirmed entrant owes the same fee (`entryFeeSettlement` in `lib/domain/money.ts`). The fee can
  be confirmed before the competition ends, and the usual payment marks and reminders apply. The fee can still change
  after the draw, and a new confirmation is a new version.

Tests: `tests/tournament-formats.test.ts`.

## Bracket presentation

The elimination draw is a connected tree. Its two halves advance from the left
and right toward a central final, using persisted fixture dependencies. Nodes
show both teams, scores, the winner and live status. Selecting a fixture reveals
the existing start and score controls below the chart. All viewers can explore
the diagram; server-side management and scoring permissions remain unchanged.

The chart scrolls within its own region on small screens, with zoom, fit-all and
original-size controls. It never rearranges the bracket into an unconnected
vertical list. Group standings and all tournament rules remain unchanged.
