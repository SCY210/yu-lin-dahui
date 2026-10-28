# Home page and activity list

The home page shows only what needs attention today. The Activities tab is the full catalogue.

## Home page (`app/home-today.tsx`, `lib/client/home-today.ts`)

From top to bottom:

1. **Unpaid fees** (`app/home-unpaid.tsx`). One entry per activity with unpaid bills of the latest confirmed split. When the member also owes for friends they registered, the entry lists each bill and the total. When the activity has a fee recipient, the row shows the recipient and a copy button. The "mark paid" button records a self-reported payment (`feePaid`) for every bill of that activity without leaving the page.
2. **To-dos** (`homeTodos`):
   - scores to enter for the member's own games of activities that are no longer running (a live game gets a "record score" button on its live card instead);
   - sign-up deadlines within `signupSoonHours` (24 h) for open activities the member has not joined;
   - waitlist promotions from the last `promotionNoticeHours` (24 h).

   Each activity and kind appears once, in that order.
3. **Live activities** (`liveActivities`). One highlighted card per running activity, merging all of its courts. If the member is on court, the card names the court, partner and opponents. Otherwise it shows a resting hint.
4. **Recently ended** (`recentlyEnded`). Activities that ended in the last `recentlyEndedHours` (24 h, as long as the MVP vote is open), or that the organiser ended early. While the member may still vote (`canCastAwardVote`) and has not voted, the card offers the MVP vote. Otherwise it links to the results.

Below these, the bond list (`app/home-bonds.tsx`, see `docs/BONDS.md`) ranks the member's bonds with every other member, strongest first.

When nothing applies, a quiet empty state links to the Activities tab. The component re-evaluates every 15 seconds, so cards appear and expire on time without reloading.

## Activities tab (`groupEvents`)

Upcoming activities are split into:

- **Signed up** (first group): activities with an active (not cancelled) registration of the member;
- **Open for sign-up**: open for sign-up and before the deadline;
- **Other activities**: everything else upcoming, such as locked or full activities.

Ended and cancelled activities are collapsed under a **history** disclosure, newest first.

## Toasts in the ink-wash theme

`app/wuxia-toast.css` restyles Sonner toasts under `html.wuxia-theme`: a rice-paper background, square corners, serif type, and a thick left edge in the theme's pigments (green for success, cinnabar for errors and plain toasts, ochre for warnings). The classic theme keeps its existing colours.

## Header and home shortcuts

The treasure shop card on home and on the member page is replaced by a gift icon to the left of the reminders button in the header, on every page. Its accessible name and tooltip carry the balance. Home no longer shows the create-activity, create-tournament and activity-guide buttons; they remain on the activities page. The member page no longer lists the account-notice receipts; the receipts themselves are still stored, as the privacy notice describes.

## Scoring any court from home

Anyone who may score the activity (signed up for it, its organiser or an administrator, the server's score permission) gets a score button on every court of the running activity's card, not only their own game. When an activity is no longer running, its unscored games become one to-do per activity with the number of games; it opens the viewer's own game first. Only the viewer's own game still opens the score form by itself (`pendingScores` and `pendingOwnScores` in `lib/client/score-reminder.ts`).
