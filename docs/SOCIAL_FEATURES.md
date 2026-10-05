# Social features and game modes

The social entry is on home; game modes are inside activity details. Fees remain participant cost shares without paid/unpaid status or collection.

| Feature | Current behavior |
|---|---|
| Pairing | Select fairly by opportunity, then balance strength; additional repetition costs discourage the previous partner. Manual swaps and locks remain available. |
| Rematch challenges | A player can challenge an opponent who beat them in a valid match. The target account responds. An activity manager links an accepted challenge to an unstarted match with opponents on different sides. Scores determine the outcome. |
| Partner relationships | Played games, wins/losses and win rate. Labels require at least three matches; weakest-partner comparisons need two qualifying partners. |
| Opponent relationships | Doubles matchup results; labels need three matches and include partner influence, so they are not singles-strength measures. |
| Random roles | Normal partners, random pair, mentor/student, or experienced/new-player labels generated reproducibly from the round seed. They are game labels, not real relationships. |
| Player profiles | Experience, handedness, preferences, style, equipment, self-assessed level, avatars, and racket photos. Server ownership/administrator checks apply. |
| Style votes | Eight preset tags, keyed by account/player/tag; clicking again retracts a vote. |
| Activity awards | MVP, defense, net play, effort; one vote per account/category, changeable, no self-votes. Enabled confirmed registrants or actual attendees are candidates; eligible participants and managers can vote during supported activity stages. Cancelled activities cannot receive votes. |
| Lighthearted statistics | Close-loss counts, best-of-three games, losing streaks, extended scores, actual match duration; absent records remain absent. |
| Relationship graph | Select a player and partner/opponent mode; show six frequent connections with full lists below. Nodes open profiles. |
| Form | Win rate across at most ten recent valid complete matches; >=70 hot, <=30 low, fewer than five insufficient. |
| Tiers | Bronze/silver/gold/platinum/diamond, thresholds 900/1050/1200/1400. First ten Elo games provisional. Numeric ratings/history are hidden from ordinary members. |
| Handicap | With the option enabled and a mean-rating gap >=120, propose roughly one negative starting point per 60 rating gap, at most eight. A manager confirms before play; applied handicaps do not affect Elo/monthly points. |
| Arena | A designated physical court retains the winning pair. Losing players cannot immediately re-enter that arena next round; waiting players challenge. Other courts rotate normally. Corrected results rebuild winners/streaks. |
| King/Queen | Single-game rounds; personal totals accumulate actual team points, then wins and net difference break ties. Pair rotation is prioritized. |
| Rotation planning | Use valid participant states, busy players, and full booking coverage. Eleven players with three courts can use two courts with eight playing/three resting; recompute each round for arrivals/departures. |
| Event labels | Early arrival, close-to-start arrival, fastest signup, or waitlist promotion only when the underlying timestamps exist. Old missing timestamps are not fabricated. |
| Photos | Associate an activity, selected match's four players, or actual attendees. This is record association, not facial recognition. Uploaders must confirm rights and permission before sharing. |
| Annual calculations | Madrid start-year aggregates, partners/opponents/streaks/match duration remain implemented, but the annual-summary UI entry is currently hidden. |
| Best of three | Validate each game's legal terminal score; match result uses games won, while point difference sums the games. |

## Capacity and persistence

An event's creator sets capacity (integer 1-500); it is not fixed at sixteen. Managers can adjust it but cannot reduce below the confirmed list. Increases promote eligible waitlisted registrations in order.

Migration 0002 adds challenges, tag votes, award votes, and photo metadata without rewriting earlier migrations. D1 stores relationships; the Sites-managed BUCKET binding stores image bytes in R2. Existing JSON payloads tolerate optional fields.

Writes verify profile ownership, challenge history/target, and activity vote eligibility. Unique vote keys and atomic revisions protect duplicate/concurrent writes. Photos require authentication and membership; draft/deleted activity visibility remains restricted.

Avatars/racket photos and activity photos have their own permission checks. Formats, dimensions, file/body size, byte quotas, and image-rights acknowledgement are checked server-side. Production never automatically loads fictional local fixtures.

## Verification

Run domain/social/voting/permissions tests with npm test. tests/social-api.mjs requires a dedicated fictional local database and the activity/match fixtures described in its comments, normally after tests/api.mjs. Never point these at real data.

Verify photo byte round-trips and associations, session-separated challenges, vote uniqueness, capacity, game modes, score corrections, hidden numeric Elo, persistence after restart, and 390px access. No automatic identity/face recognition is claimed. High-load, real-device, and long-term member statistics need separate validation.
