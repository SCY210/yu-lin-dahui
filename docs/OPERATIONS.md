# Operations and recovery

## Diagnose an incident

1. Record the time, failing operation and `X-Request-ID` response header.
2. Find `http_request` and `api_failure` records for that identifier in the
   hosting platform's Worker logs. Compare status and duration for the affected
   route. Request bodies and credentials must not be added to logs.
3. For 429, honor `Retry-After`; for 409, refresh the current revision before
   retrying. Reuse an operation's request ID when retrying a submitted write.
4. For 503, inspect database bindings, migration compatibility and resource
   availability. Corrupt stored JSON is a server-side data incident.

Structured logging is shipped in the source. Retention, log access, dashboards
and alert delivery still depend on the Sites hosting controls and must be
verified there. No external monitoring account has been provisioned.

## Production release

1. Use the pinned Node version and locked installation, then run `npm run verify`.
2. Record the Git commit, successful CI run and intended migration list.
3. Test the release in an isolated staging environment with fictional records.
4. Confirm a current recovery point covers both D1 and R2 images before any
   production data migration. A club JSON export is not a complete backup:
   it excludes login credentials, sessions, notification tables and image bytes.
5. Publish through the existing Sites release workflow; record the actual
   release identifier and run authenticated smoke checks.
6. Keep the previous compatible release available for rollback. Do not assume
   rolling application code back also reverses database changes.

GitHub synchronization and Sites publication are distinct operations. This
modernization delivery only updates the Git branch.

## Recovery drill required before readiness sign-off

Confirm the hosting owner has the needed D1 and R2 backup/export/restore access.
Create an isolated destination; never rehearse against the production database.
Restore database and image objects from a matching recovery point. Verify:

- The owner and a regular member can log in, with roles and visibility intact.
- Activities, signup order, matches and expense allocation versions match.
- Monetary totals reconcile and historical scores replay as expected.
- Photos and avatars resolve to restored objects.
- Session, push and notification behavior is understood after restoration;
  no test notification is sent to real devices.

Record the restore commands actually used, dataset sizes, recovery duration,
recovered timestamp and any gaps. Agree an acceptable recovery time and data
loss window based on the club's needs, then repeat the drill after relevant
storage changes. Production backup coverage and restoration have **not** been
verified by local unit/integration tests.
