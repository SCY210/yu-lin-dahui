# No-shows

When a match has started (live, round-by-round or planned scheduling) and a player is not there, the match can be closed as a no-show instead of being scored. The club owner asked for this rule so that only the absent player is penalised.

## Who can report

The activity's creator, an administrator, or any other player of the same match who is present can report. Absent players cannot report themselves. The report is only possible after the match has started and before any score has been entered. At least one player must remain. If nobody showed up, the organiser cancels the match instead. A second absent player of the same match can be added afterwards.

## Effect (`lib/domain/no-show.ts`)

- The match becomes a `forfeit` with `noShow` listing the absent players.
- **Absent players:** each absent player gets one rated loss against the other team, using the normal long-term rating formula from the scores before the match. This also counts as −1 season point. In `replayRealmScores`, the no-show produces one synthetic game per side that has absent players, and only those players are updated.
- **Everyone else:** the partner and opponents gain or lose nothing. The match does not count toward their games, and it does not use up their turn in live rotation (`liveAppearances` counts a no-show match only for the absent players).
- **Rotation:** the court is refilled at once in live mode. Waiting players keep their usual priority.
- **Plain forfeit unchanged:** the organiser's existing whole-match forfeit still rates nobody.

## Coming back

Absent players are added to the activity's `noShowHold`. Live rotation (`livePresentIds`) and round or planned generation (`readyIds`) skip them until the player, their registrant or an organiser confirms arrival. The confirmation action is `noShowArrived`, shown as an "I have arrived" button above the activity's match list.

Tests: `tests/no-show.test.ts`.
