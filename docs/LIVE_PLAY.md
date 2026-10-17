# Live court rotation

The activity match page shows the games currently on court. Its host or an administrator starts live rotation once; each court advances independently when an authorized signed-up account submits a valid single-game result. Other courts keep playing. The result, waiting preferences, closed round and new games share the existing optimistic, idempotent D1 transaction.

No game start, end or estimated-duration input is required. Internal timestamps remain for historical scoring and audit compatibility; signup attendance and actual court booking windows still constrain who can play. Starting rotation preserves the event's registration status, completed results and games already in progress. Unstarted old planned rounds are cancelled and replaced by live assignments; legacy scheduling APIs remain for old data but cannot create another plan while live rotation is enabled.

Selection first favors fewer appearances in this activity, then an earlier previous turn and signup order. It excludes unavailable, disabled, waitlisted and already-playing people, mixes confirmed participants at the same venue, and deduplicates physical courts. It then balances the four selected players' teams and varies partners. Confirmed fixed partners remain paired. Fairness is constrained by presence, venue, fixed partners and availability; it never forces a resting player onto court.

Each participant (or the account managing their proxy profile) can choose not to play consecutive games. After their game ends, they skip the next game and return when a later-started game at that venue ends. A simultaneous earlier-started game ending does not count as the skipped game. If substitutes are insufficient the court waits. A rested person can explicitly mark themselves ready, retaining their preference for later games. The host can adjust participants' preferences and pause/resume automatic filling; pausing does not prevent current games from being scored.

Visible activity pages refresh shared state every three seconds, retaining the existing hidden/offline suppression. Results can be corrected without creating an extra next game. Repeated or concurrent requests retain the existing request-key and revision protection.

Validation includes multi-court progression, unique on-court participants, 14-player balanced rotation, fixed teams, missing substitutes, permissions, in-progress games at other events, score corrections, and actual handler/SQLite tests for persistence, request replay, rollback and concurrent scoring. New settings use existing JSON payloads and need no schema migration.

## Starting the next game on a court

A court that has finished a game no longer starts the next one by itself. It waits until someone presses the next-game button on the court (`liveNext`): anyone signed up for the activity, its organiser or an administrator. The selection below picks the waiting players first and fills up with the ones who just came off. If only the four (or two) players of the last game on that court are available, the request is refused, so they can wait for another court to finish and mix. The button then offers to keep the same players on purpose (`allowSame`).

Courts that have not had a game yet still start on their own: at the start of the activity, when a court slot opens, or when players arrive. The organiser starting live play, or arranging free courts, fills every free court. A no-show refills its court at once, because it replaces a player rather than finishing a game. A waiting court is not work for the read-time clock (`hasEmptyLiveCourt`).

After the activity has ended by the clock, unscored games are no longer shown as live: the page reads "activity ended" with the number of unscored games, and the live controls are closed.

## Bench priority

When a court becomes free, available waiting players take precedence over that court's just-finished players. Fewer cumulative games or an earlier previous start must not bypass the bench. Game counts and waiting time balance players within each priority group; willing just-finished players fill only the remaining places. Fixed partners remain intact, and requested breaks, venue/attendance eligibility and other active courts still apply. The preceding court lineup is derived from stored matches, so pause/resume and write retries preserve this order. Existing games and results are unchanged; the next score advances with the corrected selection.

## Correcting the current lineup

The current games are shown like a planned round: one expanded panel with every current court, the courts waiting for their next game, and the waiting players. Activity creators and administrators correct a lineup the same way as a planned round: tap the swap icon of one player, then of the player to trade places with. That can be a partner or opponent on the same court, a waiting player, or a player on another court; the select-based **Adjust players** form and the per-court bench panel are retired. The `liveSwap` command checks the whole current lineup snapshot (409 when it changed), rejects scored games and fixed partners, and validates every touched game with the same candidates as below before storing anything. Games stay swappable until their score is recorded.

The older `liveLineup` command, which sets both teams of one game, remains for compatibility. No reason field is required; a before/after audit is recorded automatically. This explicitly changes only the current game (including partners); the activity's fixed/rotating mode still controls later games. The server resolves permission from the stored match and checks current signup/venue/time availability, duplicate players, other active courts, requested breaks and an expected-lineup snapshot. Completed games and stale lineups cannot be edited this way. Saving keeps the match ID, start, court and round, does not record a result or generate a new game, and updates the waiting roster and appearance counts to the corrected lineup.

Waiting players are the present members who are not on court and not taking a requested break. A player on a break is not offered and cannot be swapped onto a court; members end their break with the ready-again button.
