# Cancelled signups

At the club owner's request, everyone who can see an activity can also see who signed up and then cancelled.

## What is shown (`app/cancelled-signups.tsx`)

The signup tab has a collapsed section, "cancelled · N", placed after the signup list. Newest cancellations come first. Each entry shows:

- the name, with the registrant for friends;
- the cancellation time (Madrid);
- who did it: the member themselves, the registrant of a friend, or an organiser (with their name);
- the reason, if one was typed. The texts the app fills in automatically when the reason is left empty are not shown as a reason.

A member who signs up again leaves the list. With court signups, a member appears only once all of their court signups for the activity are cancelled.

## Rules unchanged

Members can cancel freely until the cancellation deadline (one day before the start). After it, a member's cancel only becomes a request, and the signup stays until an organiser cancels it. A pending request is not listed as cancelled. Once the organiser approves, the entry says it was cancelled by the organiser.

## Data (`lib/domain/cancellations.ts`)

When a registration becomes fully cancelled, `cancelledAt`, `cancelledBy` (account) and `cancelReason` are stored on it. Signing up again clears them.

Cancellations from before these fields existed are recovered from the latest `cancel` or `courtCancel` audit entry of that player in that activity. If none is found, the entry has no time and says only "cancelled".

The club projection replaces the raw fields with a `cancellation` view, so members never receive account ids or the audit log.

Tests: `tests/cancellations.test.ts`.
