# Storage migration

The club JSON download omits credentials and uploaded files. Use a complete
storage snapshot when moving an existing club to a standalone Worker. Production
snapshots and object bytes are sensitive; keep them in ignored, controlled local
storage and never commit them.

## Temporary source export

The Worker has a read-only operator export under `/_operator/migration/`. It
returns 404 unless both runtime variables are configured: `MIGRATION_EXPORT_TOKEN`
(64 lowercase hexadecimal characters from a cryptographic random generator) and
`MIGRATION_EXPORT_EXPIRES_AT` (Unix milliseconds, no more than 24 hours ahead).
Keep the token secret. Send it only in the Authorization header as a Bearer token.
Never place it in a URL, client bundle, source file or log.

GET `snapshot` returns all 32 application tables, schema and foreign key violations
in one transactional D1 batch without cell truncation. GET `objects` lists R2
objects with metadata and a continuation cursor. GET `object?key=...` requires
an `If-Match` header containing the listed etag and fails if the object changed.
No endpoint accepts SQL or writes to the source. Responses are private/no-store.

Configure secrets using the hosting provider's runtime secret controls. Deploy
the source version to apply them. Remove both variables and redeploy immediately
after completing the export; verify the endpoints return 404 even with the former
token. The expiry is an additional safeguard, not a substitute for cleanup.

## Destination and acceptance

Verify the destination is empty and save its pre-migration schema/metadata before
applying the journaled migrations. Rehearse the import against an isolated local
database. Preserve account IDs, owner configuration, password salts/hashes,
business history and photo references. Do not reuse active sessions, rate-limit
counters, browser push subscriptions or queued push jobs/deliveries on a different
origin. Visitors must log in and enable notifications again.

Use inserts that fail on duplicate keys; never use REPLACE or clear an occupied
destination. Verify exact per-table row counts and canonical row digests, compare
schema and foreign key violations, and verify every referenced R2 object's size
and SHA-256 after upload. Retain each object's HTTP/custom metadata. Confirm the
source did not change during export; a later source revision needs reconciliation
before switching visitors. Preserve the original site as the recovery source.

Verify the public Worker URL, original password login, owner permissions and
private photo access. A successful deployment alone does not establish a working
migration. Record the snapshot timestamp and acceptance results without copying
private records or credentials into shared documentation.
