# Treasure shop

The treasure shop uses a separate integer currency. Redeeming an item never
changes ranking points, strength ratings, cultivation realms, or match results.
Members start with zero coins. Coins come from automatic activity rewards or
manual owner adjustments. There are no cash payments, shipping, or default
catalog items.

## Automatic activity rewards

The activation timestamp is recorded once on the server. Only activities whose
end time is after that timestamp qualify. Activities that ended before activation
are not backfilled, including when their scores are later edited.

After a qualifying activity ends, the server settles rewards automatically:

- Each positive ranking point earned from a match win awards one coin, including
  the win's upset and consecutive-win bonuses. The server uses the same canonical
  winning-game points as the ranking, with consecutive wins scoped to their
  season and singles/doubles format. Losing a match does not deduct coins.
  Ranking points may still decrease independently.
- Every 4 points matches in a row attended on time earn an attendance-streak
  reward, 20 coins by default and adjustable by the owner and administrators.
  See [Automatic activity coins](AUTOMATIC_COINS.md#attendance-streak).
- Eligible participants receive five coins per activity, once across all courts
  and time slots. A confirmed elapsed attendance interval or a completed match
  establishes participation; waitlist-only entries and no-show/awaiting-arrival
  holds without completed play do not. Cancellation without actual participation
  gives no bonus, while preserved attendance before cancellation still counts.
  An entirely cancelled or deleted activity gives no reward. Temporary guests do
  not have wallets. Disabling an account after genuine participation does not
  remove its already-earned entitlement.
- Manual ranking-point changes, MVP/voting bonuses, and notification bonuses do
  not create coins. The owner can continue to adjust coins separately.

The wallet and its transactions are the authoritative result. The compact
"Coin reward rules" disclosure in the shop explains the ratio, the activation
boundary, and corrections without expanding the catalog page by default.

Repeated settlement does not repeat the reward. Correcting or voiding a score
recalculates the affected reward instead of adding another award. A correction
may reclaim unspent automatic coins that were awarded incorrectly; an ordinary
loss never does. Manual grants and redemption refunds are protected, including
when a correction is first discovered. Redemptions spend automatic coins first.
Wallet balances remain nonnegative. If incorrect coins have already been spent,
the outstanding correction is shown separately and offsets later automatic
earnings. It is not a cash charge and does not change the member's ranking.
Manual coin grants and redemption refunds retain their own ledger entries.

## Club owner

Open the shop from Home or My page. The club owner can create and edit products,
set their coin price and available stock, and take them off sale without losing
existing order history. Prices and stock must be integers.

The owner can manually grant or deduct coins from a member with a reason. A
deduction cannot make the member's wallet negative. Other administrators do not
receive these permissions. Temporary guests do not have wallets.

Redemptions reserve stock immediately. The owner marks a pending order as
fulfilled after handing over the reward. Cancelling a pending order refunds the
exact original cost and restores its stock once; fulfilled orders cannot be
cancelled through this flow.

## Members

Members see their own wallet, coin transactions, and redemption history. The
catalog shows the current price and available stock. Confirmation uses that
displayed price; if it changes before saving, the member must review the updated
price. The server resolves the account, price, total, balance, and stock itself.

The shop opens directly on the catalog. The coin balance sits on the right of
the compact title row. Products use a compact exhibition grid: two columns on phones, three on tablets
and four on wider screens. Tiles show the product name, price and stock. Opening
a tile reveals the full description, quantity controls and live total in a
dialog; redemption still requires the existing confirmation. Category filters
remain available as text tabs. History,
transactions and owner management remain collapsed, compact links below the goods.
Transactions identify activity rewards, reward corrections, owner adjustments,
redemptions, and refunds. A pending reward correction is visible above the goods
only when it is nonzero; the owner can also see it beside each member's balance.

## Persistence and concurrency

Products, coin transactions, reward settlement records, and orders are stored in D1 using additive
schema migration. They participate in the existing commit-revision transaction
gate. A conflicting write rolls back the whole batch, preventing overselling or
partial deductions. Retried redemptions reload current state and validate it
again. Authenticated request IDs deduplicate writes; order snapshots retain the
product name, unit price, quantity, and total at redemption time.

Shop confirmations keep their request ID across manual retries after an
ambiguous network failure. Opening a new confirmation creates a new ID. Product
edits also carry the displayed product's integer version: any intervening edit,
redemption, or refund makes a stale editor fail instead of restoring old stock.

Ordinary members and administrators receive only their own transactions and
orders. Only the club owner can inspect all wallets and orders. This also applies
to non-owner administrator exports and audit views.

## Validation

Run `npm run verify` for repository checks, type checking, lint regression checks,
migration history, unit and integration tests, and the production build. The
shop API suite uses an isolated SQLite database and exercises permissions,
validation, idempotency, persistence, concurrent redemption, refunds, and view
privacy. UI coverage checks confirmation payloads and owner controls; browser
checks should include narrow mobile widths and long product names.
