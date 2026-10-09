# Participant cost shares

The app displays each participant's amount with court, shuttle, and other-cost details. Home/personal pages do not show unpaid balances. The activity cost page does not offer payment records, confirmation, refunds, or paid/unpaid states. Members can view all participants' shares in their club.

Payment writes are disabled; normal club APIs do not return historical payment records. Existing storage is retained for compatibility without a destructive migration. Split algorithms, participation time, exemptions, club subsidies, and settlement versions remain.

Verify that participant shares plus subsidy and unallocated amounts equal the source total in integer cents. Administrative/member views must not expose payment records. A disabled payment action must reject without changing the revision.

Cost sharing is a calculation tool, not payment processing, tax advice, a debt collection system, or confirmation that a venue has been reserved. Organizers remain responsible for actual payments and applicable financial duties.

## Shuttle usage recorded per ball

The "Record actual shuttle usage" form only asks for the shuttle model, the price per ball (EUR per ball), and the number of balls used, plus the optional consumption start/end, bearer, and reason. It no longer has a pricing choice, balls per tube, whole tubes used, or extra loose balls; convert whole tubes to balls (one 12-ball tube plus 4 balls = 16).

- New records are saved as pricing 'unit': shuttle cost = price per ball × ball count, which is already whole cents. The server rejects new per-tube ('tube') shuttle costs and asks the client to refresh, so stale cached pages cannot keep writing per-tube records. The tubeCount field stays in the data model: new shuttle records store 1, and other costs may omit it (default 1).
- Existing pricing 'tube' records are not migrated or rewritten. ballCents keeps the original formula (tube price × balls ÷ balls per tube, rounding half-up below one cent), so historical splits and saved versions keep their amounts; tests/shuttle-usage.test.ts covers this.
- Legacy display: when the tube price divides evenly by the balls per tube, the equivalent per-ball price is shown together with the original tube price, for example "EUR2.00 per ball (legacy EUR24.00 per 12 balls)". Otherwise (for example €25.00 / 12 balls) the per-ball price is not a whole cent, so it is shown unchanged as "Legacy record priced per tube" to avoid changing the total.
- Cost items have no edit action (only removal and interval adjustment), so legacy records are never converted automatically. To switch one to per-ball pricing, remove it and record it again per ball; when the equivalent per-ball price is not a whole cent, the new total can differ by a few cents and needs a manual check.
- Activity shuttle candidates and voting only carry a name and notes, with no price or tube count, and are unchanged.
