# Self-service account deletion and administrator resignation

Members use **My → Account and password → Account and permissions**. Both actions require an unchecked confirmation; password-authenticated users must also supply their current password. Requests act only on the authenticated account: no target account ID is accepted. Same-origin writes, rate limits and atomic revision gates apply.

## Thirty-day deletion

Requesting deletion records server timestamps with an exact grace period of 30 × 24 hours. All password sessions and push subscriptions are removed atomically. Authentication rejects pending accounts, including legacy platform sessions, so background reads, other devices and polling cannot cancel deletion. The browser receives a signed-out cookie valid for 30 days and a local notice with the actual deadline in Madrid time.

A successful password login before the deadline atomically creates a new session and cancels the request. Incorrect passwords do neither. The deliberate legacy sign-in flow returns through `/api/auth/return`, verifies the hosting identity and cancels a still-recoverable request. At the deadline itself, restoration fails even if cleanup has not run yet. Password reset, username changes and unrelated actions do not constitute restoration.

The Worker handles an hourly scheduled event (`0 * * * *`, UTC) and retries cleanup on API requests. Thus removal is due after exactly 30 days and normally processed at the next hourly invocation, rather than guaranteed at the precise millisecond. Deployment operators must verify that the hosting platform registers the configured cron trigger; the source and production build alone do not establish that it runs in production. Without a registered trigger, API traffic still performs cleanup but an idle Site will not. Each sweep processes up to 20 expired accounts and 50 image cleanup jobs; subsequent runs continue the backlog.

Cleanup permanently removes the account, credentials, sessions, reminders/preferences, related audit snapshots, notice receipts, personal currency/redemption records, profile details and site photo metadata uploaded by or associated with the member. A fresh unowned, disabled player with the generic deleted-member label replaces the former player in retained match and cost records, including settlement share keys. Future registrations/attendance are removed and waiting lists promoted. Friend profiles remain with no owner association. Other players retain currency grants, with the deleted actor cleared through a nullable foreign key. Shared sporting/financial facts remain available without the original account/player IDs. Commit keys that contain the account ID are rewritten to opaque revision keys. A one-way hash of the former platform identity is retained solely to deny reactivation by a surviving platform session; it does not reserve a username or restore the profile.

Image object keys go into a durable cleanup queue in the same D1 transaction. R2 deletion happens after the transaction and retries on later sweeps. A storage failure cannot restore authentication or lose the cleanup job. Database failures roll back the whole operation. Existing historical migrations are immutable; migration `0013_account_lifecycle.sql` adds deletion requests, denied-identity hashes and the image cleanup queue. It makes currency-ledger actors nullable with `ON DELETE SET NULL`, preserving other players' balances. Notice evidence remains immutable during normal use: its deletion trigger permits cleanup only while a server-recorded deletion request for that exact account has expired. Updates remain prohibited.

Other people's free-text references, exported files, backups and hosting logs remain outside automatic cleanup and require operator handling. This feature does not establish legal compliance or a universal retention policy. The public privacy notice describes its actual scope, including these limits.

## Administrator resignation

An administrator other than the protected principal owner can immediately change their own role to member, without principal-owner approval. The account and sporting records remain. Existing sessions see the current member role on their next authorized request. Resignation cannot change another account or grant any privileges. Later elevation still follows the existing principal-owner role management rules. The protected owner and last-administrator safeguard remain enforced; owner handover is a separate process and is not implemented by these controls.

## Validation and release

The isolated lifecycle integration suite exercises real password cookies, same-origin protection, confirmation/password requirements, forged target rejection, member resignation denial, owner protection, deadline cancellation, session revocation, expired-login rejection, transactional cleanup rollback, historical foreign keys, notification cleanup and retryable image erasure. It never targets production accounts.

Run `npm run verify` before GitHub synchronization. Merge the approved shared changes into the controlled private Cloudflare release source, preserving private customization. Verify migration application, the scheduled trigger, and fictional-account smoke checks in staging before production readiness. Do not test irreversible deletion on real users.
