# Fee advances

Members book courts and buy balls themselves; a member can book at most two hours a day, so one activity is often booked by several people. Every court slot and expense therefore records who advanced it, and a confirmed split is settled by transfers between members instead of everyone paying one recipient.

## Recording who advanced what

- Creating an activity lists its court slots: court name, start, end and **who booked it**, all required. Slots booked by different members, or two courts at the same time, are separate rows: a slot can be split in two at its middle half hour (for example a four-hour court booked by two members for two hours each), and another court is added at the same time as the first slot. Rows move with the activity start. A practice activity with balls also names whose balls they are.
- **One court booked in turn stays one slot** (`lib/domain/booking-advancers.ts`). Rows of the same court, venue and price that follow each other without a gap are saved as one court slot, so the activity page shows one sign-up list for it, with its whole time and each booker's part. The later bookers are stored as `handovers` (`{at, advancedBy}`, inside the slot and in time order). A slot added later on the activity page right before or after the same court extends that slot the same way. Rows with a gap, another court or another price stay separate.
- Moving a slot's start or end drops handovers outside it; the part covering the new start keeps its booker.
- **Each part is visible and editable** (`app/court-parts.tsx`). Every part lasts at least one hour. Members usually book up to two hours, so a new split prefers two-hour parts, but longer parts are allowed for exceptions without a warning (`minPartHours`, `usualPartHours` in `app/court-parts-model.ts`). The creation form and the court settings on the activity page first ask how many members booked the court (six hours: one booker, or 2 to 6 parts; three parts start as 2 + 2 + 2, two parts as 3 + 3). The whole bar of parts, drawn to scale, is the drag area: pressing anywhere picks the nearest boundary, a sideways drag moves it by whole hours, and a tap moves it to the tapped hour, never making a part shorter than one hour. A vertical swipe still scrolls the page. Each part then gets its booker. A single booker for a longer court stays allowed; the form points out how many parts it needs. Settings save the parts as `handovers` on `bookingEdit` (an empty list leaves one booker); `booking` accepts them too. Every part needs a booker.
- Court fees are shared by everyone taking part while the court is booked, whichever court they signed up for, so two courts at the same time filled 6 and 5 give all 11 the same share, and a court nobody signed up for is shared by those present at that time. When part of a fee still cannot be shared, the fees page names each court or expense and time with its amount. This is unrelated to who advanced it: nobody took part in the activity at that time.
- Balls and other expenses added on the fees page name who bought or paid them, required on new activities.
- Organisers can set or correct the advancer of any court slot or expense from its row on the fees page (`feeAdvance`). This also fills in activities created before advancers existed. A slot booked in turn has one button per part; the request names the part by its start (`at`).
- An advancer is an enabled member with an account. Friends registered by a member cannot advance.
- New activities carry `feeAdvances: true`; their split cannot be confirmed until every item with a cost has an advancer. Older activities keep the old way of paying until every advancer is filled in. Their next confirmation then uses transfers, and already confirmed versions are never rewritten.
- The two-hour booking limit is not checked by the app.

## How the split is settled (`lib/domain/fee-transfers.ts`)

Shares are calculated exactly as before. Then, at confirmation:

1. Each advancer is repaid what they actually paid: the cost of every court slot, court part or expense they advanced. On a slot booked in turn, each booker's part is the cost of the time they booked, summed exactly and rounded once per slot. Equal shares are rounded up per person (docs/FEE_CONFIRMATION.md), so members together owe a few cents more than the costs. Those cents go to the advancers in proportion to what they paid, so the totals balance to the cent. The fees page lists each advancer's actual payment and notes the rounding cents separately. Until November 2026 each item's advance was the sum of the members' rounded shares of it. With 2 + 1 hours at 6.90 €/hour, 7 € of balls and eight players, that showed 13.84, 6.88 and 7.04 instead of 13.80, 6.90 and 7.00. Older confirmed versions keep their amounts and paid marks. A recalculation that only moves rounding cents (every person's net within 20 cents) does not count as a change, so organisers are not asked to confirm them again, and confirming again keeps the existing version (`sameSettlement` in `lib/domain/settlement-state.ts`). A real change, such as a new advancer, collector or cost, still needs a new version.
2. A friend's share is owed by the member who registered them, so only members transfer, and never to themselves.
3. The owner owes the club-subsidised parts (subsidised courts or expenses, and subsidy exemptions).
4. Each person's net is what they advanced minus what they owe. An advancer whose advance covers their own share owes nothing and shows as paid at once; if their share is larger, they pay the difference.
5. **With a collector**: the fee recipient is now chosen from the members. Everyone who owes transfers to the collector, and the collector repays every advancer. The collector's home page lists each repayment.
6. **Without a collector**: debts are matched to advancers largest first, giving at most one transfer fewer than the people involved.

The advances, the transfers and the collector are stored with the confirmed version (`advances`, `transfers`, `collector`). Changing an advancer or the collector changes the result, so the organiser confirms a new version.

## Marking transfers

- Every transfer is marked on its own (`feeTransferPaid`), by its payer, its receiver or an organiser.
- The collector keeps their own share out of what they collect, so their status shows what they still have to repay to advancers (`collectorRepayment`): pending repayment with the amount, then repaid once every repayment is marked. This applies on the fees page and on My. Other members keep the usual paid or pending-transfer status.
- A person counts as paid once all their transfers are marked; unpaid reminders, the reminder button count and "My page" use this.
- Marks are stored per payer and receiver (`payments` rows with `to`), so a later version keeps them, and a raised amount shows as unpaid again.
- Marking a whole bill (`feePaid`) is refused on a version settled by transfers.
- The fees page shows what each advancer advanced, the viewer's own transfers with mark buttons, and everyone else's transfers. The home page lists each transfer the member still has to make and can mark them all. It also lists the transfers the member is still waiting for, which they can mark as received ([Fee payments](FEE_PAYMENTS.md#where-members-see-unpaid-fees)).

## Verification

`tests/court-handovers.test.ts` covers joining rows of one court, repayment by part in every split mode, handover validation, slots added later, moved slots and per-part correction. `tests/fee-advances.test.ts` covers the worked example (two bookers, a ball buyer and a proxied friend), collector mode, the owner's subsidy, transfer marking permissions and kept marks, required advancers on new activities, the old way for older ones, and a randomised balance check of the transfer planner. UI and API tests cover the creation form, the fees page and recipient selection.
