# Match player filter

The activity match view offers an All players selector, an Only my matches
shortcut, and a Clear filter button. Selection is scoped to the current
activity and remains stable during data refreshes.

Filtering matches either side of a match, including temporary guests and
historical participants whose signup was cancelled. Resting or merely being
eligible for a round does not count as playing. Planned rounds retain their
original numbering. Live and completed matches, withdrawn rounds, and resolved
tournament fixtures use the same player selection. Unrelated cards are hidden;
matching round and history sections open automatically.

Filtering never edits the domain data. Rotation statistics, venue availability,
score permissions, tournament standings, and the next round that may start
continue to use the complete activity. Empty results explain that the selected
player has no matches. See `tests/match-player-filter-ui.mjs` for regression
coverage.
