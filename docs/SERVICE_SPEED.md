# Service speed

A production sample of six full club GET handler metrics before this change ranged from 1044 to 1592 ms, with a median of 1306 ms. These are handler timings, not end-to-end device load times. Clients sent compressed-response weak ETags, which the previous exact-string lookup could not match.

GET validators now accept the weak form of a known club token and lists containing it. A hit returns one canonical ETag and 304, avoiding full state reads and view aggregation. Authentication and fresh revision/account/owner/profile-policy metadata still precede every hit. Unknown tokens, expired entries, another account, changed roles/queries and active-activity time boundaries retain full reads. No personalized response or database snapshot is shared in memory. Cold isolates may still miss the bounded validator cache.

Completed date-repair and fee-confirmation jobs share one indexed commits lookup instead of two sequential lookups. Pending jobs keep their original order and transactional retry checks. No negative result is cached and no pending job is marked complete merely for speed.

Production improvements are assessed using normal traffic after release. Local SQL-count checks establish saved database operations rather than predicting network latency.
