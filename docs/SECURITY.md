# Security controls and verification boundaries

Production remains on HTTPS through Sites. The login entry is public; club data, fees, players, events, and photos require server authentication and membership. Do not expose the underlying Worker or development identity emulation directly.

## Requests and abuse limits

- Login limits use the trusted platform IP and a username/IP pair, so failures from one IP do not directly lock out another IP's legitimate login.
- Writes use account/IP limits; uploads add count and daily byte quotas. Atomic D1 counters coordinate across instances and concurrent requests. HTTP 429 includes Retry-After.
- Writes validate exact Origin, Fetch Metadata, and Content-Type before bounded body parsing. Auth JSON is limited to 8 KiB, business JSON to 64 KiB, total multipart uploads to 6 MiB, and each image to 5 MiB.
- Body reception has an absolute deadline: ten seconds for JSON and thirty for photo forms, beginning when the reader starts. New chunks do not extend it. Timeout returns 408; explicit client abort returns a safe 400. Failure cleanup releases the lock and starts cancellation without waiting for it.
- Early rejected requests also receive bounded cleanup: at most the route's size budget and 250ms, without parsing/retaining contents. Oversize, timeout, or stream failure cancels the read.
- Expired rate-limit rows are cleaned in indexed small batches, not full scans per counter.
- Client timestamps must be safe integer milliseconds from 1970 through Madrid's end of 2100, rejecting huge values that could break date formatting.

Defaults: eight username/IP login attempts per fifteen minutes; 120 business writes per account/five minutes; ten photo uploads per account/ten minutes. Members may create twenty friend profiles, ten events, and upload 50 MiB per Madrid day. Administrators may create one hundred profiles/events and upload 250 MiB. Repeated committed request IDs do not debit daily quotas twice. Logout is not blocked by login-attempt quotas.

## Images and privacy

JPEG/PNG/WebP uploads receive structural/dimension validation. The maximum side is 12,000 pixels and total pixels at most fifty million, with animation limits. These are structural checks, not a guarantee that arbitrary bytes are harmless in every decoder.

Uploads require an unchecked-by-default image-rights acknowledgement, checked again on the server before storage. The audit records the uploader's acknowledgement and policy version. This is evidence of the uploader's statement, not proof of consent from each depicted person.

Photo reads authenticate/authorize every time and use private, no-store, Vary: Cookie, and nosniff. Logout/account changes do not rely on cached private images.

Cross-tab session notifications contain only a change type and random identifier. Other tabs clear private snapshots/password inputs and verify new cookies with the server; history-cache restoration also revalidates. The PWA caches only the public offline fallback.

Existing uploaded image bytes can contain EXIF/location or other embedded metadata; current structural validation does not strip it. Operators must avoid unnecessary metadata or sanitize images before sharing and must not claim it has been removed.

## Response headers

The Worker applies MIME-sniffing protection, restricted referrer information/device permissions, HSTS, and a CSP restricting objects, base URLs, forms, and embedding to this site and official preview hosts. Private entry/API responses are not cached; static asset policies remain intact.

The CSP preserves Vinext inline bootstrap compatibility. It is not a nonce-based complete script whitelist. React escapes user text; map URLs use a fixed external domain and encoded parameters; image links use fixed API paths.

## Permissions, transactions, and errors

SQL values are bound parameters; table/column names come from fixed code lists. The owner uses a stable account ID and cannot be modified by other administrators. Business writes use revision transactions. Username/password changes verify the acting/target credentials and revoke old sessions.

Internal database errors, hashes, passwords, and tokens are not returned or recorded in business audits. Failed photo transactions attempt to remove uncommitted R2 objects.

## Tests

npm test runs algorithm, permission, request, image, navigation, timestamp, session, cache, and PWA regressions. Use separate fictional loopback fixtures for tests/security-api.mjs and the other HTTP suites. Never attack production, reset real passwords, or run reset-local-test.sql against real data.

tests/request-body-timeout.test.ts uses a simulated clock for stopped/trickling bodies, stuck cancellation, client aborts, normal parsing, and ten/thirty-second boundaries. tests/request-body-http.mjs verifies a slow chunked login on a built loopback Worker, 408/no session/no-store, and subsequent normal auth responses without DB writes.

Original request-body hardening validation on 2026-10-05: 297 automated tests and isolated read-handler checks passed, as did TypeScript, changed-file ESLint, and the production build. A local Worker generated 408 at about ten seconds. Its HTTP adapter delayed delivery until the client finished the eleven-second upload; this does not demonstrate immediate production-edge termination.

Run the HTTP regression with REQUEST_BODY_TEST_ORIGIN=http://127.0.0.1:8794 and an isolated built Worker. It rejects non-loopback origins and needs no initialized accounts/migrations.

Application limits reduce common resource abuse; header/connection timeouts, distributed traffic mitigation, and verified edge identity stripping remain hosting responsibilities. Source review and local tests do not certify a deployed instance or legal compliance. See [legal readiness](LEGAL_READINESS.md).
