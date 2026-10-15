# Friends brought by members

At the club owner's request, a friend whom a member signs up has no profile and no rating or points. The friend is shown as that member's friend.

## Who is a friend (`lib/domain/guests.ts`)

A friend is any player without an account of their own whose owner is another member's account. This covers friends created through "add friend and sign up", the older standalone friend creation, and existing friends. Every member has their own account, so members are never treated as friends. A friend who later joins with their own account becomes a regular member.

## Rating and points

- A friend has a fixed **level**, picked when they are added. The levels are 850 (just started), 1000 (average, the default), 1150 (strong) and 1300 (very strong).
- In `replayRealmScores` the friend's score is set to their level at the time of each match. The friend is never updated, never counts games, and never receives season points.
- Members who play with or against a friend are rated as usual, against that fixed level. Leaderboards already list members only.
- Grouping and live rotation read `player.rating`, which equals the friend's current level after the replay. The gender rule in `docs/GENDER_BALANCE.md` uses the same value.
- A new friend must also be given a gender (male or female, `guestGender`), which doubles pairing needs (`docs/GENDER_BALANCE.md`). The same people can change it later with the `guestGender` command; it only affects line-ups generated afterwards.
- The registrant who brought the friend, an administrator, or the organiser of an activity the friend joined can change the level (`guestLevel`). Each change is stored with its time in `guestLevels` and applies from then on; earlier games keep the level the friend had then.

## Display

The club projection marks friends with `guest`, the registrant's name in `guestHost`, and the current `guestLevel`. This is needed because members do not receive the account list. On the page:

- Signup rows, match cards and the live bench show "<registrant>'s friend" next to the name.
- The name does not open a profile, and friends are left out of the players list.
- The signup tab has a "temporary friends" section that lists the activity's friends with their levels and a change button for those allowed.

Tests: `tests/guests.test.ts`.

New guests keep the activity scope introduced by the Add friend flow: they cannot be reused in another activity. `guestEventId` also identifies a guest when a calculation receives only a partial state without the account list. Merging upcoming activities makes a separate target-scoped guest identity and preserves the recoverable source.

Profile, gender, avatar and racket writes for both legacy proxy guests and scoped guests are rejected on the server; activity level changes remain allowed for their authorised registrants/managers. No historical profiles, registrations, scores or fee records are deleted. When applying this rule to existing proxy friends, member rating history and strength-based upset bonuses are replayed against the guest's fixed historical level (1000 when no chosen level exists), so derived member totals can change. Recorded scores remain unchanged.
