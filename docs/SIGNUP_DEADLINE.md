# Sign-up deadline

New sign-ups close two hours before an activity starts (`signupCloseHours` in `lib/domain/event-lifecycle.ts`).

- **Creation.** A new activity stores `start - 2 h` as its `signupDeadline`. If it is created less than two hours before it starts, members can sign up until the start time.
- **Older activities.** Activities created before this rule stored their end time as the deadline (or none at all). `signupClosesAt` treats such values as `start - 2 h`, so every activity follows the same rule without a data migration.
- **What closes.** After the deadline, a member cannot start a new sign-up, either for themselves or for a friend, through `register` or `courtRegister`. Members who are already signed up can still change their time slots, and cancellation keeps its own rules. Activity organisers and administrators can still add players at any time before the activity ends.
- **Interface.** The court sign-up summary shows the deadline date and time, or "closed" once it has passed. For a member who is not signed up, the sign-up button is disabled and labelled as closed. On the home page, the "closing soon" to-do and the activities tab's "open for sign-up" group both use the same deadline.

Tests: `tests/signup-deadline.test.ts` and `tests/court-signup.test.ts`.
