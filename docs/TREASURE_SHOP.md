# Treasure shop

The treasure shop uses a separate integer currency. Redeeming an item never
changes ranking points, strength ratings, cultivation realms, or match results.
Members start with zero coins. This version has no automatic rewards, cash
payments, shipping, or default catalog items.

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

## Persistence and concurrency

Products, coin transactions, and orders are stored in D1 using an additive
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
