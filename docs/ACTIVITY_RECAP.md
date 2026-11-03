# Activity recap

Once an activity has ended, its overview starts with a battle summary card (`app/event-recap.tsx`) when it has scored games. The summary is computed in the client by `activityRecap` in `lib/domain/activity-recap.ts`, from the completed matches the viewer can already see. It adds no server work, stored data, writes or clock boundaries: the card appears with the existing end-of-activity status.

The card shows:

- the number of games, players who played and points scored;
- the MVP, once voting has closed (`mvpWinners`);
- the top winners by games won, tied players together (at most three);
- the best win rate of a player with three or more games, when it beats the top winner's rate;
- the longest run of wins in a row, three or more;
- the best pair: the doubles partners with the most wins together, two or more;
- the closest game (smallest margin, then most points) and the most one-sided game (margin of ten or more);
- the viewer's own games, wins and losses, when they played.

Games are the individual games of each completed match (`gameFacts`), in the order they ended, so a best-of-three counts as several games. Matches still playing, voided games and other activities are ignored. `tests/activity-recap.test.ts` checks the rules with fictional matches.
