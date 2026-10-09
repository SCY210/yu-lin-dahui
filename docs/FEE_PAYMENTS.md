# Fee payments and reminders

## Proxy-registered friends

A friend registered by a member who has no account of their own cannot receive notices. Their fee notice goes to the
account that registered them (`feeContact` in `lib/domain/fee-payments.ts`). That account gets one personal
confirmation notice naming the friends whose fees it should pass on or pay; players paying only for themselves share
the ordinary notice. Once the friend has their own account, notices go to them directly. Disabled players and disabled
proxies receive nothing.

Notices never contain amounts, because they can appear on a lock screen. The fees page shows each amount.

## Marking a bill paid

After the split is confirmed, a player taps "Mark paid" on the fees page. The player, the account that
registered a proxied friend, and the activity's creator or an administrator can mark or unmark a bill. A self-reported
payment covers the current bill total; older stored payments still count. If a later confirmed version raises the
amount, the earlier payment no longer covers it and the bill shows as unpaid again. Marking or unmarking requires the latest confirmed settlement ID, so an old page cannot silently mark a changed bill paid. The member view receives only the
activity, player and amount of each payment.

## Reminding unpaid players

The former "Notify players" button is now "Remind unpaid (N)". It sends a personal reminder to every
account that still has an unpaid bill of its own or of a proxied friend. Each reminder request is delivered (it is not
deduplicated against the confirmation notice), at most once every six hours per settlement version. The button is
disabled when everyone has paid, and the server refuses the request in that case. Reminders respect the fee confirmation
notification preference and are cancelled if a newer version is confirmed before delivery. Delivery rechecks current payments and proxy ownership: fully paid recipients receive nothing, and partially paid proxy groups name only friends who still owe.

## Saved payees

Every transfer recipient saved for an activity is kept in the club settings as a saved payee (matched by the digits
of the phone number, so a renamed payee updates in place), newest use first and at most 20. Activity managers see them
in the transfer section of the fees page and apply one with a single tap instead of typing the name and number again.
The member who added a payee, or an administrator, can remove it; removing it never changes recipients already set on
activities. The member view receives each payee's name, phone and whether the viewer added it, never the adder's id.

## Verification

`tests/fee-payments.test.ts` covers fee contacts, confirmation and reminder notices, mark and unmark permissions, raised
amounts, the six-hour limit and the projected fields. `tests/fee-payees.test.ts` covers saving, renaming, the
20-payee limit, removal permissions and the projected fields. `tests/push-api.mjs` covers encrypted delivery of
reminders, request idempotence and the six-hour refusal.
