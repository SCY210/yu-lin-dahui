# Bonds

Every pair of members has a bond (`lib/domain/bonds.ts`, stages in `lib/domain/bond-tiers.ts`). Its affinity score sets its stage, from the reference table the owner provided. The table glosses the stage names; the app shows the Chinese names in `bondTiers`.

| Stage | Affinity |
| --- | --- |
| 1. Chance meeting | 0–300 |
| 2. Passing acquaintance | 300–1,500 |
| 3. Sworn friendship | 1,500–5,000 |
| 4. Daily companions | 5,000–15,000 |
| 5. Through storms together | 15,000–50,000 |
| 6. Like siblings | 50,000–80,000 |
| 7. Kindred minds | 80,000–150,000 |
| 8. In life and death | 150,000–250,000 |
| 9. Perfect match | 250,000–350,000 |
| 10. Stronger than gold | 350,000–500,000 |
| 11. Bosom friends | 500,000+ |

Stages are titles with a colour of their own (the table's hues, darkened to read on light cards; the last two have a gradient). They carry no other reward.

## Earning affinity

- **Playing as partners.** Every game two members play on the same side of a completed match adds 60, plus 40 if they win it. Opponents and singles add nothing. Each game is multiplied by the boost of the stage the pair had reached by then (×1, 1, 2, 4, 8, 10, 14, 18, 22, 26, 30). A pair that partners for about three games a week, winning half, reaches stage 2 within a month, stage 5 in about half a year and the last stage in about three years (`tests/bonds.test.ts` checks this pace). The score is replayed from match history, so games played before the feature count too.
- **No coin gifts.** Members cannot give each other coins, so nobody can pool coins from others. Coin gifts made in the short time they were allowed (`gift_sent` / `gift_received` rows that move coins) stay in the ledger and still count at 50 per coin.
- **Giving a shop item** (`treasureRedeem` with `giftTo` and `message`). The giver redeems a product with their own coins as usual; the order records the receiver and the note, and the owner hands the item over. The bond gains 50 per coin of the item's price. A cancelled order refunds the giver and its affinity is removed.

Gifts are stored as treasure ledger rows, with no new table: the giver's `redeem` row names the receiver, and the receiver's row (`gift_received`) names the giver. A shop gift's receiver row moves no coins. Both members of a pair derive the same score from their own rows.

## Where it shows

- **Profiles.** Another member's profile shows the viewer's bond with them under the bond section (`app/bond-card.tsx`): the stage, affinity, progress to the next stage, the current boost, partner games and gifts, a button to give a shop item, and the full stage table. A member's own profile and guests' profiles show none.
- **Gift notices.** A member who received a gift sees a popup when the app opens (`app/gift-popup.tsx`): who gave what, with the note. Closing it records the gifts on the account (`giftSeen`, `Account.giftSeen`); gifts older than 30 days are not announced.
- **Shop.** Ledger rows name gifts given and received; orders bought as a gift say whom they are for.

The club view sends each member only their own bonds and gift notices (`bonds`, `me.giftNotices`); nobody sees the bond between two other members.
