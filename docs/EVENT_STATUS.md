# Activity status badges

The club owner reported an activity that showed "报名中" (open) after its two-hour sign-up deadline had passed. The badge used the stored `status`, which stays `open` until an organiser changes it.

## Derived status (`lib/client/event-display-status.ts`)

Activity cards and the activity header show one derived state. The first rule that matches decides it:

| State | When | Look |
|---|---|---|
| cancelled | stored `cancelled` | struck-through text on a dashed red outline |
| draft | stored `draft` | dashed grey outline |
| ended | the end has passed, or ended by an organiser | solid ink |
| live | the start has passed, or started by an organiser | solid red with a pulsing dot |
| locked | stored `locked` | violet |
| closed | the sign-up deadline (`signupClosesAt`) has passed | slate blue |
| full | every place is taken; new sign-ups join the waitlist | amber |
| open | otherwise | green |

Each state has its own colour in both themes (`app/event-status-badge.css`). The live, ended, cancelled and draft badges also differ in shape (solid, struck-through or dashed), so they can be told apart without relying on colour alone. The badge refreshes at the start and end of the activity, and every 30 seconds, so it changes to closed without a reload.

Tests: `tests/event-display-status.test.ts`.
