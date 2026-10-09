# Profile editing permissions

`PROFILE_GENDER_ONLY_PLAYER_IDS` is an optional runtime JSON array of stable player IDs. Configure it in Sites, keep its values outside the public repository, and deploy after changing the environment. Missing or empty configuration retains existing behavior; invalid configuration produces a safe server failure rather than permitting edits.

For a configured player, profile editing permits only the strict `profileGender` command. Nickname and full-profile writes, avatar/racket uploads, and avatar/racket deletion are denied by the server, including administrator requests. Existing ownership and protected-owner checks still apply. Other authentication, activity, score and fee permissions are unchanged.

The client receives only each player's effective `profileEditMode`. The profile form offers gender alone and hides avatar, racket-upload and rename controls. Existing photos and profile values remain readable. Gender updates preserve existing fields; an absent profile is initialized with the existing display defaults.

Policy is loaded from runtime configuration on every state read and is not persisted as a user-editable record. Conditional-read validators include the policy so an unchanged business revision cannot retain stale controls. Uploaded files and historical profile records are not deleted when applying a restriction.
