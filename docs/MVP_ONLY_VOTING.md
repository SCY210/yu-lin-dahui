# MVP-only post-match voting

Post-match voting offers only MVP. Each eligible account has one vote per activity, can change or withdraw its own choice, and cannot vote for itself. Existing participation, activity-end and cancellation rules remain.

Other award categories and style-tag voting are closed in the server command boundary. The activity page has one MVP ballot without category switching, four-award progress or a style-voting panel. Player profiles no longer show style-vote results. Future award reminders describe MVP only.

Legacy award and tag records stay in storage for historical integrity. Normal club responses return MVP award votes only and an empty legacy tag-vote array. No migration deletes historical votes; MVP changes or withdrawals preserve other stored records and other accounts' choices.

## Deadline, points and named votes

At the club owner's request:

- **Deadline.** Voting closes 24 hours after the activity's scheduled end (`awardVotingClosesAt`). An activity ended early by its organiser opens voting at once and still closes 24 hours after the scheduled end. Late votes are rejected.
- **Points.** When voting closes, the player or players with the most MVP votes (at least one) each receive 5 season points (`mvpPoints`). Tied leaders all receive them. The points count on the activity's singles or doubles board, in the month the activity started (`mvpPointAdjustments`), and the leaderboard lists them as MVP points. There are no MVP points for practice, tournament, cancelled or draft activities. The cached club view expires at the closing time, so the result appears without a write.
- **Named votes.** Only administrators and the owner see who voted for whom; the projection adds `voterPlayerId` for them only. Everyone else, including an organiser who is a regular member, sees only the counts and their own vote. The voting hint does not mention this.
- **Notice.** When a member opens the app with unacknowledged extra points (an MVP award or a positive owner grant from the last 14 days), a dialog congratulates them. Its confirmation button (the owner chose a playful "I am the best!") stores the acknowledgement on their account (`bonusSeen`, `lib/domain/bonus-notices.ts`).

Tests: `tests/mvp-points.test.ts`.

Historical votes outside the activity start / closing-time window are preserved in storage but excluded from MVP results and points. Reward, score-reminder and notification dialogs are shown in sequence. A dismissed reward releases other prompts for the current visit even if acknowledgement saving fails; it may return next visit. Reward batches contain at most 50 notices.
