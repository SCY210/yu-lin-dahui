# Fee advances

Members book courts and buy balls themselves; a member can book at most two hours a day, so one activity is often booked by several people. Every court slot and expense therefore records who advanced it, and a confirmed split is settled by transfers between members instead of everyone paying one recipient.

## Recording who advanced what

- Creating an activity lists its court slots: court name, start, end and **who booked it**, all required. Slots booked by different members, or two courts at the same time, are separate rows. Rows move with the activity start. A practice activity with balls also names whose balls they are.
- Balls and other expenses added on the fees page name who bought or paid them, required on new activities.
- Organisers can set or correct the advancer of any court slot or expense from its row on the fees page (`feeAdvance`). This also fills in activities created before advancers existed.
- An advancer is an enabled member with an account. Friends registered by a member cannot advance.
- New activities carry `feeAdvances: true`; their split cannot be confirmed until every item with a cost has an advancer. Older activities keep the old way of paying until every advancer is filled in. Their next confirmation then uses transfers, and already confirmed versions are never rewritten.
- The two-hour booking limit is not checked by the app.

## How the split is settled (`lib/domain/fee-transfers.ts`)

Shares are calculated exactly as before. Then, at confirmation:

1. Each advancer is repaid, for every item they advanced, the members' shares of that item plus its club-subsidised part. Equal-share rounding goes to the advancer, so the totals balance to the cent.
2. A friend's share is owed by the member who registered them, so only members transfer, and never to themselves.
3. The owner owes the club-subsidised parts (subsidised courts or expenses, and subsidy exemptions).
4. Each person's net is what they advanced minus what they owe. An advancer whose advance covers their own share owes nothing and shows as paid at once; if their share is larger, they pay the difference.
5. **With a collector**: the fee recipient is now chosen from the members. Everyone who owes transfers to the collector, and the collector repays every advancer. The collector's home page lists each repayment.
6. **Without a collector**: debts are matched to advancers largest first, giving at most one transfer fewer than the people involved.

The advances, the transfers and the collector are stored with the confirmed version (`advances`, `transfers`, `collector`). Changing an advancer or the collector changes the result, so the organiser confirms a new version.

## Marking transfers

- Every transfer is marked on its own (`feeTransferPaid`), by its payer, its receiver or an organiser.
- A person counts as paid once all their transfers are marked; unpaid reminders, the reminder button count and "My page" use this.
- Marks are stored per payer and receiver (`payments` rows with `to`), so a later version keeps them, and a raised amount shows as unpaid again.
- Marking a whole bill (`feePaid`) is refused on a version settled by transfers.
- The fees page shows what each advancer advanced, the viewer's own transfers with mark buttons, and everyone else's transfers. The home page lists each transfer the member still has to make and can mark them all.

## Verification

`tests/fee-advances.test.ts` covers the worked example (two bookers, a ball buyer and a proxied friend), collector mode, the owner's subsidy, transfer marking permissions and kept marks, required advancers on new activities, the old way for older ones, and a randomised balance check of the transfer planner. UI and API tests cover the creation form, the fees page and recipient selection.
