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

## Automatic reminders

The hourly Cloudflare cron (`build/sites-worker.ts`, `lib/fee-reminder-sweep.ts`) reminds unpaid players without anyone pressing the button:

- 24, 48 and 72 hours after a split is confirmed, every account that still has an unpaid bill of its own or of a proxied friend gets the same personal reminder as the manual button. Paying stops further reminders; a fully paid split drops out.
- 24 hours after the third reminder, if any bill is still unpaid, the owner and administrators are told once, with the names of those who still owe. An administrator without a bill of their own still receives this push.
- Reminders are only sent between 09:00 and 21:59 Madrid time. A reminder that falls due at night waits for the morning. If the cron misses several steps, it sends one reminder, never a burst.
- Only the latest confirmed version counts. A newer version starts its own schedule, and the replaced version is forgotten. Splits confirmed more than seven days ago, and deleted or cancelled activities, are not reminded automatically.
- Progress per settlement version is stored in the `fee-reminder-sweep-v1` settings row. It is committed in the same batch as the notices, so a retried tick never sends a step twice. Pushes queued by the cron are delivered by the cron itself, without waiting for a visit.
- An idle tick runs one small query, and outside reminder hours none at all. A tick with work reads only recent settlements, their events and payments, and the accounts and players, never the whole club.

The manual "Remind unpaid (N)" button is unchanged and independent: organisers can still remind at any time, at most once every six hours per version.

## Saved payees

Every transfer recipient saved for an activity is kept in the club settings as a saved payee (matched by the digits
of the phone number, so a renamed payee updates in place), newest use first and at most 20. Activity managers see them
in the transfer section of the fees page and apply one with a single tap instead of typing the name and number again.
The member who added a payee, or an administrator, can remove it; removing it never changes recipients already set on
activities. The member view receives each payee's name, phone and whether the viewer added it, never the adder's id.

## Where members see unpaid fees

- My page: each row of the activity and split list shows a green "paid" or red "unpaid" label for the member's own bill.
- Home page: while the member owes a confirmed fee, for themselves or for a friend they registered, a highlighted
  notice at the top lists each activity, whose bill it is and the amount, and opens the activity's fees tab. It
  disappears once every bill is marked paid. Only the latest confirmed version of each visible activity counts
  (`lib/client/my-fees.ts`, covered by `tests/my-fees.test.ts`). A newer confirmed split that removes a member also removes their older bill from My page.

## Reminder button

The reminder button in the header switches to a ringing, highlighted icon with the unread count (99+ above 99) while
the reminder centre has unread notices. The count refreshes on load, on every page change, when the tab becomes
visible and every minute while visible; a failed read keeps the last count. Only the latest request may update the count. Account changes clear the old count immediately; onboarding without a club account makes no reminder request.

## Verification

`tests/fee-payments.test.ts` covers fee contacts, confirmation and reminder notices, mark and unmark permissions, raised
amounts, the six-hour limit and the projected fields. `tests/fee-payees.test.ts` covers saving, renaming, the
20-payee limit, removal permissions and the projected fields. `tests/push-api.mjs` covers encrypted delivery of
reminders, request idempotence and the six-hour refusal.
