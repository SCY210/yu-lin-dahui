# Administrator-managed accounts

The app does not offer public self-registration or require email. Administrators create usernames and passwords; new accounts always start as members. Role management is a separate protected operation.

## Creating and migrating accounts

1. The owner verifies the existing platform identity and enables password login from the personal account page. The same profile, permissions, photos, and match history remain associated.
2. In group administration, create an account with a display name, username, and initial password. New usernames accept 2-32 ASCII letters/digits, case-insensitively; legacy non-Latin, underscore, and email-style usernames still work. A changed username follows the new policy. Passwords are 12-128 characters.
3. Link an existing player profile when appropriate. Enable login on an existing account rather than duplicating its identity.
4. Deliver the initial credentials directly to the person through an appropriate private channel. The app sends no automatic email/messages and never displays saved passwords.
5. Reset a forgotten password as an administrator. The change revokes all target-account sessions while preserving its role and business records.

Passwords come from the user or administrator, not source-code defaults. Fictional test accounts belong only in dedicated local databases.

## Changing usernames and passwords

A member can change their own username once, after verifying their current password. The owner can change their own or another person's username repeatedly, using the owner's password rather than requesting the member's password.

An owner-initiated rename does not consume or reset the member's self-service allowance; resetting a password does not reset it either. A successful self-change records the usage timestamp. Duplicate names, invalid formats, incorrect passwords, and concurrency failures do not consume the allowance.

Changing one's own username signs out all sessions; changing another member's username revokes that member's sessions while preserving the owner's session. Account/player IDs, protected owner status, photos, costs, and match relationships remain stable. Login usernames and display names are independent.

The current password is required for a self-service password change. A reset or change revokes previous password sessions atomically.

## Access boundary

Only the login entry is public. Club lists, events, scores, costs, and images require membership. The legacy platform sign-in entry is for migration. Production does not create accounts from the historical invitation code.

Sites must remove untrusted identity headers before forwarding requests. Keep the underlying Worker behind that distribution layer. Development emulation is loopback-only and absent from production builds.

## Implementation

- Salted scrypt: N=16384, r=8, p=5, constant-time comparison.
- 256-bit session tokens; only SHA-256 token digests stored server-side.
- HttpOnly, SameSite=Lax cookies; Secure on HTTPS; 14-day expiry. Logout deletes the session and suppresses legacy identity auto-login.
- Exact-origin checks, an 8 KiB body limit, a 10-second absolute JSON receive deadline, and persistent IP/username rate limits.
- Credentials and business records commit in one atomic D1 batch. Idempotency keys and unique usernames prevent duplicate account creation.
- Session issuance rechecks the validated username, salt, and password hash to prevent a concurrent reset from issuing a usable stale-password session.
- Retries reload administrator permissions. Members and anonymous callers cannot create accounts, reset others' passwords, or bypass protected owner checks.
- Passwords, salts, hashes, and session tokens are excluded from business exports and audit payloads.

Migrations 0003-0006 establish and evolve credentials, username keys, and the self-change timestamp. New password accounts have an empty legacy email field. Existing platform-account email fields remain for compatibility.

## Verification

Use tests/managed-accounts.mjs, tests/change-username-api.mjs, tests/change-password-api.mjs, and tests/ownership-api.mjs only with their documented fictional loopback fixtures. They cover identity preservation, permissions, idempotency, session tampering/revocation, username policy, concurrent reset/login, origin checks, and protected ownership.

Historical machine-specific execution reports are ignored; run results must state their own environment and scope. HTTP loopback checks do not certify HTTPS cookies or production edge identity stripping.
