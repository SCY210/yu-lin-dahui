# Bounties

A post-match game for points matches, chosen by the club. The scheduler assigns partners and opponents, so every bounty is about how a member plays in the games they are given, never about whom they play with (`lib/domain/bounties.ts`).

## Offer

- From 30 minutes before a points match starts (`bountyOfferAt`), about 60% of the members with a confirmed signup are offered one bounty. Points matches are ranked activities that are not tournaments and are not drafts, cancelled or deleted. Guests and waitlisted members get none.
- The draw is a fixed hash of the activity and the member (`drawnBounty`), so every refresh and device shows the same offer, and nothing is stored until the member answers.
- The member accepts or declines once (`bountyRespond`, own account only). The offer stays open until the member's first game of the activity starts, so nobody can accept after seeing how they play, and closes at the end of the activity. Declining costs nothing.
- When the offer opens, each member offered a bounty gets one notice in the reminder center and as a device push (`lib/bounty-reminders.ts`). A ten-minute Cloudflare cron (`lib/bounty-reminder-sweep.ts`) looks for activities starting in the next 30 minutes; an idle tick runs one small query. The notice names the bounty, its goal, the reward and the penalty, and opens the activity. Members confirmed later, for example from the waitlist, are told on the next tick; nobody is told twice, and nobody once the activity has started. A queued push is dropped if the member has already answered or is no longer confirmed. Members can turn bounty notices off in their reminder preferences; preferences saved before this option count as on.
- The app pops the offer up once per visit after other dialogs (`app/bounty-offer.tsx`). Closing it only postpones the answer: the offer stays at the top of the home page and on the activity page (`app/bounty-card.tsx`).
- Each bounty kind opens the pop-up with its own animated xianxia scene and seal (`app/bounty-effects.tsx`): flying swords arriving one by one for the win streak, a lightning strike that splits the ground for the rout, a golden koi leaping over the dragon gate for the upset, and two qi orbs clashing into a turning taiji for the deuce. The scene is decorative and hidden from screen readers. Every element rests on its final frame, so with reduced motion the finished scene shows without movement.

## Challenges

| Bounty | Goal | Default reward |
|---|---|---|
| Win streak | win 5 games in a row in this activity | 30 coins + 15 points |
| Upset | win a game against opponents whose average realm score before the match is at least 250 higher than your side's | 20 coins + 10 points |
| Rout | win a game in which the opponents score 9 or fewer | 15 coins + 8 points |
| Deuce | win a game after 20-all (for example 22:20) | 10 coins + 6 points |

Only completed games count; a no-show forfeit is not a game. The realm score comparison uses the averages recorded in the realm ledger before the match (`RatedGame.team` and `opponent`).

## Settlement

- An accepted bounty is judged once the activity's scheduled end has passed (`bountyOutcome`). It is derived from the stored games, so a score entered or corrected later settles it again.
- Completed: the frozen points are added on the activity's singles or doubles season board in the month it started (`bountyPointAdjustments`, shown as a bounty line on the leaderboard), and the frozen coins are paid as an automatic coin reward (source `bounty`, docs/AUTOMATIC_COINS.md).
- Accepted but not completed: the frozen penalty, 10 points by default, is subtracted on the same board.
- The cached club view already expires at every activity's end, so results appear without a write.

## Settings and privacy

- The owner and administrators set each bounty's coins and points and the penalty under group management, in the bounty settings (`bountySettings`, audited). Accepting freezes the reward and penalty in the answer, so a later change only affects bounties accepted afterwards.
- Answers are private: the club view sends each member only their own, with its result; administrators see all (`lib/club-view.ts`).

Tests: `tests/bounties.test.ts`, `tests/bounty-ui.mjs` and `tests/bounty-reminder-sweep-api.mjs`.
