# Bounties

A post-match game for points matches, chosen by the club. The scheduler assigns partners and opponents, so every bounty is about how a member plays in the games they are given, never about whom they play with (`lib/domain/bounties.ts`).

## Offer

- From 30 minutes before a points match starts (`bountyOfferAt`), about 60% of the members with a confirmed signup are offered one bounty. Points matches are ranked activities that are not tournaments and are not drafts, cancelled or deleted. Guests and waitlisted members get none.
- The draw is a fixed hash of the activity and the member (`drawnBounty`), so every refresh and device shows the same offer, and nothing is stored until the member answers.
- The member accepts or declines once (`bountyRespond`, own account only). The offer stays open until the member's first game of the activity starts, so nobody can accept after seeing how they play, and closes at the end of the activity. Declining costs nothing.
- The app pops the offer up once per visit after other dialogs (`app/bounty-offer.tsx`). Closing it only postpones the answer: the offer stays at the top of the home page and on the activity page (`app/bounty-card.tsx`).

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

Tests: `tests/bounties.test.ts` and `tests/bounty-ui.mjs`.
