# Automatic activity coins

Formal members earn one coin per positive winning-game ranking point and five participation coins once per activity across all courts. Ordinary activities can earn participation coins without winning-game points. Losses, owner point adjustments, notification points and MVP/voting bonuses never generate negative coin rewards or mint automatic coins.

Winning-game points include upset and consecutive-win bonuses from the canonical ranking calculation. Consecutive wins are scoped to the season and singles/doubles format. Complete earlier game history establishes or breaks a streak before the reward activation boundary is applied, but earlier activities still receive no retroactive coins. Changing an earlier result can therefore correct the winning-game reward of a later eligible activity.

The durable policy activates once using the production Worker version timestamp. Events already ended at activation are excluded permanently, including later date changes. Rewards wait for the scheduled activity end. Existing genuine play and archived attendance determine participation; temporary guests, waitlist-only and absent players do not earn wallets or attendance rewards. A later disabled account does not erase earned history.

Unique source claims and the existing optimistic D1 commit transaction make replay, polling and concurrent settlements idempotent. Score edits, voids, cancellation, reopening or time extension reconcile entitlements in the same transaction as the business mutation. A completed archived activity keeps earned sources; archiving does not award newly invented sources.

Only unspent automatic coins can be reclaimed. Independent grants and refunds are protected. A spent overpayment becomes pending correction, offset only by future automatic earnings; spendable wallet balances remain nonnegative and fulfilled orders are never reversed. Durable per-wallet ledger sequence makes funding replay independent of equal timestamps or database row-return order. Claims, correction debt and provenance stay server-controlled.

The private production Worker checks for due rewards every five elapsed hours. An hourly Cron Trigger reads only the persisted cursor until five hours have elapsed, without scanning activities, settling rewards or advancing the cursor. This preserves the interval across midnight, unlike an hour-of-day step that resets each day. The first check after changing the schedule may align to the next hourly tick. Eligible checks inspect policy and activity/result timestamp metadata; full state reconciliation runs only for new due boundaries. The separate scheduler cursor cannot overwrite club settings and advances only after successful settlement. Normal authenticated reads and writes still reconcile immediately, so active users need not wait for the next background check. No public HTTP endpoint can trigger or supply arbitrary reward amounts.

`CF_VERSION_METADATA` supplies the initial activation timestamp; subsequent deployments do not move the persisted policy. `treasureRewardClaims` and the extended ledger payload are introduced by migration0015. Preserve the private release channel, original theme/permission files and migration-first deployment workflow. Never run a production release from the shared or review checkout.

Validate domain rules, actual SQLite rollback/races, wallet provenance, UI privacy and the scheduled waiting/idle/due/failure paths. Confirm production bindings, the hourly wakeup and the five-hour interval gate. The first deployment must initialize the policy without awarding old activities. Do not test by minting coins for real members.

Provider references: [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/) and [version metadata](https://developers.cloudflare.com/workers/runtime-apis/bindings/version-metadata/).

## Attendance streak

Members also earn coins for coming to points matches in a row (`attendanceStreakClaims` in `lib/domain/automatic-coins.ts`):

- Every 4 points matches in a row that a member attended on time earn the streak reward on the 4th, and the count starts again. So the 4th, 8th, 12th and so on in an unbroken run each earn it.
- A points match is a ranked activity that is not a tournament and was not cancelled, left as a draft or deleted. Singles and doubles count together, in the order they started. Ordinary activities, practice and tournaments neither count nor break a run.
- Attending uses the same rule as participation coins (a confirmed signup with genuine play or attendance; not waitlist only, not a no-show). Missing a points match, including one the member did not sign up for, starts the count again. So does being reported late; a mistaken late mark that an organiser clears does not.
- The whole history establishes or breaks a run, but only activities inside the reward rollout earn, and only after their scheduled end, like the other automatic rewards.
- The reward is 20 coins by default (`defaultAttendanceStreakCoins`). The owner and administrators can change it, or set 0 to stop new rewards, from the treasure shop's reward rules (`treasureStreakReward`, audited). An awarded run keeps the amount it was awarded with; the change only affects runs completed later.
- Like every automatic source, a later correction (for example a late report added afterwards) reconciles the entitlement in the same transaction.

Tests: `tests/attendance-streak-coins.test.ts` and `tests/treasure-shop-ui.mjs`.
