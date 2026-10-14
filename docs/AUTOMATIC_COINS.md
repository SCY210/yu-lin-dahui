# Automatic activity coins

Formal members earn one coin per positive winning-game ranking point and five participation coins once per activity across all courts. Ordinary activities can earn participation coins without winning-game points. Losses, owner point adjustments, notification points and MVP/voting bonuses never generate negative coin rewards or mint automatic coins.

Winning-game points include upset and consecutive-win bonuses from the canonical ranking calculation. Consecutive wins are scoped to the season and singles/doubles format. Complete earlier game history establishes or breaks a streak before the reward activation boundary is applied, but earlier activities still receive no retroactive coins. Changing an earlier result can therefore correct the winning-game reward of a later eligible activity.

The durable policy activates once using the production Worker version timestamp. Events already ended at activation are excluded permanently, including later date changes. Rewards wait for the scheduled activity end. Existing genuine play and archived attendance determine participation; temporary guests, waitlist-only and absent players do not earn wallets or attendance rewards. A later disabled account does not erase earned history.

Unique source claims and the existing optimistic D1 commit transaction make replay, polling and concurrent settlements idempotent. Score edits, voids, cancellation, reopening or time extension reconcile entitlements in the same transaction as the business mutation. A completed archived activity keeps earned sources; archiving does not award newly invented sources.

Only unspent automatic coins can be reclaimed. Independent grants and refunds are protected. A spent overpayment becomes pending correction, offset only by future automatic earnings; spendable wallet balances remain nonnegative and fulfilled orders are never reversed. Durable per-wallet ledger sequence makes funding replay independent of equal timestamps or database row-return order. Claims, correction debt and provenance stay server-controlled.

The private production Worker runs a five-minute Cron Trigger. Idle ticks inspect only policy/cursor and activity/result timestamp metadata. Full state reconciliation runs for new due boundaries, not on every idle tick. A separate scheduler cursor cannot overwrite club settings, and advances only after successful settlement. Normal authenticated reads and writes also reconcile, so active users need not wait for the next background check. No public HTTP endpoint can trigger or supply arbitrary reward amounts.

`CF_VERSION_METADATA` supplies the initial activation timestamp; subsequent deployments do not move the persisted policy. `treasureRewardClaims` and the extended ledger payload are introduced by migration0015. Preserve the private release channel, original theme/permission files and migration-first deployment workflow. Never run a production release from the shared or review checkout.

Validate domain rules, actual SQLite rollback/races, wallet provenance, UI privacy and the scheduled idle/due/failure paths. Confirm production bindings and the five-minute schedule through read-only provider metadata. The first deployment must initialize the policy without awarding old activities. Do not test by minting coins for real members.

Provider references: [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/) and [version metadata](https://developers.cloudflare.com/workers/runtime-apis/bindings/version-metadata/).
