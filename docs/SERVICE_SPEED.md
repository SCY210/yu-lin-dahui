# Service speed

A production sample of six full club GET handler metrics before this change ranged from 1044 to 1592 ms, with a median of 1306 ms. These are handler timings, not end-to-end device load times. Clients sent compressed-response weak ETags, which the previous exact-string lookup could not match.

GET validators now accept the weak form of a known club token and lists containing it. A hit returns one canonical ETag and 304, avoiding full state reads and view aggregation. Authentication and fresh revision/account/owner/profile-policy metadata still precede every hit. Unknown tokens, expired entries, another account, changed roles/queries and active-activity time boundaries retain full reads. No personalized response or database snapshot is shared in memory. Cold isolates may still miss the bounded validator cache.

Completed date-repair and fee-confirmation jobs share one indexed commits lookup instead of two sequential lookups. Pending jobs keep their original order and transactional retry checks. No negative result is cached and no pending job is marked complete merely for speed.

Production improvements are assessed using normal traffic after release. Local SQL-count checks establish saved database operations rather than predicting network latency.

## Image delivery

Password-session image reads now authenticate the session and fetch current membership,
photo metadata and event visibility in one indexed D1 query. Previously authentication
and metadata required two sequential database trips, including on browser cache hits.
Sites identity reads retain their trusted identity boundary. Session expiry, credential
removal, membership removal, draft permissions and deleted events are checked before
any original or thumbnail response, including 304. No authorization result is cached.

Avatars request a fixed 192-pixel WebP representation; gallery and racket previews use
960 pixels. Both fit within those bounds without upscaling or cropping, retain alpha
and request animation preservation. Original links still return the uploaded bytes. Originals of 16 KiB or less bypass
conversion entirely, avoiding work that could cost more than the transfer saved.
These sizes apply to existing uploads on their first requested view as well as future
uploads, without a database migration or a bulk production rewrite.

The standalone Worker declares the optional IMAGES binding. It transforms private R2
streams directly; no public object URL is created. Generated representations use
versioned keys in the existing private R2 bucket and are reused across authorized
readers. Generation is coalesced within an isolate, bounded in concurrency and output
memory, and checks the original photo row before and after storing a result. Photo
removal deletes the original and both derived keys; the existing deletion receipt
supports retrying storage cleanup. Originals remain authoritative and unchanged.

Missing encoder bindings, quota errors or conversion failures fall back to the original.
A bounded cooldown prevents repeatedly retrying failed conversions in one isolate.
Originals and each representation have distinct viewer-bound validators, so a large
fallback cannot prevent a later thumbnail from loading. Successful reads use private
browser caching with mandatory revalidation; errors remain no-store. The service worker
does not store private media. A cold thumbnail generation adds work once; this is not
a claim that every first response has lower server latency.

The selected profile portrait is preloaded outside the lazy profile modules, so its
request can run alongside those JavaScript downloads. Prominent avatars get high
fetch priority; directory avatars remain lazy. A card upgrades its existing racket
image on pointer, keyboard or flip intent, without a duplicate JavaScript fetch.

Local checks cover real password authentication and indexed SQL plans, authorized 304s,
representation isolation, stored-thumbnail reuse, fallback recovery, deletion races,
output bounds, concurrent generation and UI resource URLs. The actual local Images/R2 fixture reduces a synthetic 3,826,121-byte PNG to a
4,722-byte avatar and a 117,632-byte preview, preserving alpha and original bytes.
Warm reads use one derived-object read and no encoding or storage writes. This
square fixture does not prove production animation or fit behavior: the installed
Miniflare implementation does not honor all transformation options. Local image
fixtures and handler checks are not production device timings or Cloudflare CPU measurements.
Run npm run verify before synchronization. The controlled private release must retain
its access configuration and the new binding; never deploy this shared checkout over
production. Review the resulting authenticated image traffic after release.

Cloudflare documents [private stream transforms](https://developers.cloudflare.com/images/optimization/binding/)
and [Images quotas](https://developers.cloudflare.com/images/pricing/). This change does
not purchase an Images plan or alter account billing settings. Hosts without a usable
binding continue serving original uploads.
