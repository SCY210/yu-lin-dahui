# Participant cost shares

The app displays each participant's amount with court, shuttle, and other-cost details. Home/personal pages do not show unpaid balances. The activity cost page does not offer payment records, confirmation, refunds, or paid/unpaid states. Members can view all participants' shares in their club.

Payment writes are disabled; normal club APIs do not return historical payment records. Existing storage is retained for compatibility without a destructive migration. Split algorithms, participation time, exemptions, club subsidies, and settlement versions remain.

Verify that participant shares plus subsidy and unallocated amounts equal the source total in integer cents. Administrative/member views must not expose payment records. A disabled payment action must reject without changing the revision.

Cost sharing is a calculation tool, not payment processing, tax advice, a debt collection system, or confirmation that a venue has been reserved. Organizers remain responsible for actual payments and applicable financial duties.
