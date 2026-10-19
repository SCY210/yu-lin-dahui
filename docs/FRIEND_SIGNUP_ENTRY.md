# Friends and activity guests

The Add friend form registers a visitor directly on the selected court. A new visitor is an activity guest, not a reusable club member profile. The form also lets an authorised registrant choose an existing system player or a guest already added to the same activity.

Guests are absent from the social-card roster, profile navigation, social summaries, permanent rating controls and club leaderboards. Profile/name/gender edits and avatar or racket uploads are rejected on the server. A guest cannot be enrolled into another activity or selected from its existing-player list. To invite the same person on another day, add a new activity guest. Existing system players retain their profiles and current registration permissions. Previously stored system profiles are not deleted by this change.

The guest nickname and registrant remain with the activity's signup, match and fee history. For compatibility with existing foreign-key links, the participant table keeps a minimal row marked with `guestEventId`; it contains no avatar or profile information, only the gender given at signup for doubles pairing (`guestGender`). This operational activity record is not offered as a club profile and is retained with the historical records that reference it. There is no automatic deletion of match or fee evidence when an activity ends.

Guests still occupy one court slot, queue when full, take part in scheduling and score entry, and receive a separate fee allocation managed by their registrant. The normal signup cutoff, cancellation boundary, ownership checks, request-id deduplication and transaction rollback apply. The daily new-guest allowance is the existing friend-creation quota. Deprecated standalone friend-profile creation is rejected, including requests from old tabs.

Merging upcoming activities copies guest identities into the retained activity, preserving the original guest and signup in the recoverable source. Guest identities are never shared across unrelated activities.

Verification covers scoped registration, profile-write rejection, excluded social/leaderboard summaries, court defaults and cutoff handling, fees and proxy ownership, persisted API results, request replay and rollback, plus activity-merge preservation. Fictional tests never change production rosters.

## Choosing who to sign up (`app/friend-signup-form.ts`)

The form offers up to three sources:

- **New guest**: nickname, gender and level are entered once for this activity.
- **My friends**: friends this member brought before, one entry per nickname. The owner and administrators see every guest instead (the option is then called All guests), each labelled with the member who brought them. Choosing one sends `mode: 'saved'` with the earlier guest as `sourcePlayerId`. The server copies the nickname, gender and latest level into a new guest of this activity, so each activity keeps its own records. The member who first brought the friend stays their `ownerId` and owes their share, even when an administrator adds them. Members can only reuse their own friends (403 otherwise).
- **Club members** (named in the club's cultivation style): formal members only, never guests. Organisers can sign up any member; others only players they own.

A friend already signed up for this activity is marked as already signed up here, and choosing them signs them up for another court. A guest whose nickname matches one already signed up for the activity (ignoring case and surrounding spaces) is refused, in the form and on the server, with a message pointing to signing up an existing friend for another court (`lib/domain/guest-names.ts`). Signing up a friend opens on My friends, then Club members, then New guest. `tests/friend-signup.test.ts` covers the duplicate refusal, reuse with copied details and ownership, the administrator view and the members-only list.

