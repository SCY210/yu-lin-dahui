# Activity status badges

The club owner reported an activity that still showed as open after its two-hour sign-up deadline had passed. The badge used the stored `status`, which stays `open` until an organiser changes it.

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

## Placement on activity cards

On activity cards the badge always sits at the top right of the title; a long title wraps beside it instead of pushing the badge onto its own line. The status rules use higher specificity than the card and theme badge rules, so the colours and borders cannot be overridden by stylesheet order.

In planned and round-by-round scheduling, a finished round's folded header is green and the round on court has a coloured edge, so state is visible without expanding. Finished match cards have a green tint. On phones, the two courts stay side by side. In each court the score (or VS) is centred above the two teams, which sit left and right with an avatar above every name, so names use the full card width.

Folded round headers have three looks: a finished round is green, the round on court is red with a pulsing dot and edge, and a round not yet played keeps the default look. In every match card team A is blue and team B is orange (label and player chips), so the two sides are easy to tell apart when read across; the winner's label gets a green ring.

## Points match badge

An activity that counts for points (`eventRankingEnabled`: singles or doubles not set to ordinary) carries a gold "points match" seal badge to the right of its state badge: on activity cards, in the activity header and next to the live label on the home page's running card (`app/points-match-badge.tsx`). Its mark is a gold hexagon with a shuttlecock and a small star, and the pill uses a gold gradient with a darker gold border, so it is not mistaken for the amber "full" state or for a folded section. Ordinary and practice activities show no badge. On cards the two badges stay together and wrap as a group beside the title.
