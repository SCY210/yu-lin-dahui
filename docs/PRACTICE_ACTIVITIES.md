# Practice activities

Practice is a third activity type alongside singles and doubles. Creation requires specific practice content, accepts the normal signup capacity/court hourly price, and offers a shuttle unit price and an optional already-known consumed quantity (zero is valid). The activity gets a Madrid date-based practice title.

Practice uses the existing server-backed court signup, waitlist, proxy registrations, cancellation and time-based expense workflow. The unit price is remembered for later consumed-ball entries; a positive creation quantity creates an ordinary unit-priced ball expense. Before the activity ends, fees are estimates using full signup spans. Confirmation, payment reporting and unpaid reminders keep their established rules.

Practice content is visible in the activity list, detail page and running home card. Its detail has signup and fees, without competitive scheduling or partner votes. Practice does not generate matches, MVP votes, ranking points or Elo. Server-side guards reject competitive actions even if called directly. Ranking replay additionally ignores any malformed imported match attached to a practice activity. Existing singles/doubles activities default and behave as before; changing type is blocked once matches have been scheduled.
