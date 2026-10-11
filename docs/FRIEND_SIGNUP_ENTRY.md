# Add a friend directly to a court signup

The initial compact-layout repair made the friend creation entry visible, but it still created only a player profile. The owner clarified that entering a friend's nickname should register that friend, without a second signup dialog.

The header and each court now use one Add friend and sign up form. New-friend mode creates the profile and the court registration atomically. Existing-friend mode reuses the selected player. With several eligible court slots, the header requires the court choice; a court-specific entry keeps its court fixed. Participation defaults to the chosen court's complete planned interval, with optional start/end fields for a shorter visit. Switching the selected court also changes those default times. Full courts place the friend on the normal waitlist.

Server validation resolves the actual court and activity, uses the authenticated account as profile owner, and delegates enrollment to the existing court signup rules. Failed, closed, foreign or invalid-time submissions leave no extra profile or signup. The API applies the friend creation quota to new-friend mode, preserves signup retries, and uses the existing request-id transaction ledger to prevent duplicate profiles after a lost response. Existing-friend mode does not consume the profile creation allowance.

Old standalone friend creation remains available for compatibility, but activity-page entries all use the combined flow. People who already created a profile can choose Existing friend instead of creating it again. This release does not automatically enroll existing profiles into an inferred activity.

Validation covers the real form conversion, multiple court defaults, ordinary-member ownership, waitlists, failed-domain-state preservation, real SQLite API idempotence and transactional rollback. Fictional tests never modify production rosters.
