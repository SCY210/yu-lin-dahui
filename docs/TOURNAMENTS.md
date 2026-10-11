# Group and knockout tournaments

Use Create competition on Home or Activities. A competition is a distinct event
with the existing signups, venue bookings, time-based expenses and permissions.
It supports singles or fixed-pair doubles; practice and ordinary scheduling remain
separate and unchanged.

The host selects formally registered players (up to 32 teams), explicitly assigns
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

## Bracket presentation

The elimination draw is a connected tree. Its two halves advance from the left
and right toward a central final, using persisted fixture dependencies. Nodes
show both teams, scores, the winner and live status. Selecting a fixture reveals
the existing start and score controls below the chart. All viewers can explore
the diagram; server-side management and scoring permissions remain unchanged.

The chart scrolls within its own region on small screens, with zoom, fit-all and
original-size controls. It never rearranges the bracket into an unconnected
vertical list. Group standings and all tournament rules remain unchanged.
