# Friends and activity guests

The Add friend form registers a visitor directly on the selected court. A new visitor is an activity guest, not a reusable club member profile. The form also lets an authorised registrant choose an existing system player or a guest already added to the same activity.

Guests are absent from the social-card roster, profile navigation, social summaries, permanent rating controls and club leaderboards. Profile/name/gender edits and avatar or racket uploads are rejected on the server. A guest cannot be enrolled into another activity or selected from its existing-player list. To invite the same person on another day, add a new activity guest. Existing system players retain their profiles and current registration permissions. Previously stored system profiles are not deleted by this change.

The guest nickname and registrant remain with the activity's signup, match and fee history. For compatibility with existing foreign-key links, the participant table keeps a minimal row marked with `guestEventId`; it contains no avatar or profile information. This operational activity record is not offered as a club profile and is retained with the historical records that reference it. There is no automatic deletion of match or fee evidence when an activity ends.

Guests still occupy one court slot, queue when full, take part in scheduling and score entry, and receive a separate fee allocation managed by their registrant. The normal signup cutoff, cancellation boundary, ownership checks, request-id deduplication and transaction rollback apply. The daily new-guest allowance is the existing friend-creation quota. Deprecated standalone friend-profile creation is rejected, including requests from old tabs.

Merging upcoming activities copies guest identities into the retained activity, preserving the original guest and signup in the recoverable source. Guest identities are never shared across unrelated activities.

Verification covers scoped registration, profile-write rejection, excluded social/leaderboard summaries, court defaults and cutoff handling, fees and proxy ownership, persisted API results, request replay and rollback, plus activity-merge preservation. Fictional tests never change production rosters.
