# Service speed

A production sample of six full club GET handler metrics before this change ranged from 1044 to 1592 ms, with a median of 1306 ms. These are handler timings, not end-to-end device load times. Clients sent compressed-response weak ETags, which the previous exact-string lookup could not match.

GET validators now accept the weak form of a known club token and lists containing it. A hit returns one canonical ETag and 304, avoiding full state reads and view aggregation. Authentication and fresh revision/account/owner/profile-policy metadata still precede every hit. Unknown tokens, expired entries, another account, changed roles/queries and active-activity time boundaries retain full reads. No personalized response or database snapshot is shared in memory. Cold isolates may still miss the bounded validator cache.

Completed date-repair and fee-confirmation jobs share one indexed commits lookup instead of two sequential lookups. Pending jobs keep their original order and transactional retry checks. No negative result is cached and no pending job is marked complete merely for speed.

Production improvements are assessed using normal traffic after release. Local SQL-count checks establish saved database operations rather than predicting network latency.

## Image delivery

Image reads fetch membership, photo metadata and the associated event in one indexed query after authentication. This removes the separate event lookup without reading club history. Successful reads use a private browser cache with mandatory revalidation: the server checks current membership and event visibility on every request before returning a body-free 304 for unchanged media. This avoids another R2 read and image transfer on repeat views. Failed requests remain `no-store`; the service worker does not cache private media.

Prominent profile, podium and scoring-dialog avatars start loading immediately. Directory avatars remain lazy so long lists do not compete for bandwidth. A card's existing racket image begins loading on pointer or keyboard intent and at the start of a flip, rather than waiting until the back becomes visible. These changes do not add a second image fetch or a persistent JavaScript image cache.

The selected theme illustration is preloaded in the server-rendered head. The landscape background now transfers 153,996 bytes instead of 2,260,846 bytes, retaining its dimensions. First-time private photo downloads still use the uploaded original; their duration depends on image size and the connection. Local regression tests count database and storage reads and check permission revocation; they do not establish a device-specific millisecond improvement.
