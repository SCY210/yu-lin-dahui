# Home page and activity list

The home page shows only what needs attention today. The Activities tab is the full catalogue.

## Home page (`app/home-today.tsx`, `lib/client/home-today.ts`)

From top to bottom:

1. **Unpaid fees** (`app/home-unpaid.tsx`). One entry per activity with unpaid bills of the latest confirmed split. When the member also owes for friends they registered, the entry lists each bill and the total. When the activity has a fee recipient, the row shows the recipient and a copy button. The "mark paid" button records a self-reported payment (`feePaid`) for every bill of that activity without leaving the page.
2. **To-dos** (`homeTodos`):
   - scores to enter for the member's own playing games;
   - sign-up deadlines within `signupSoonHours` (24 h) for open activities the member has not joined;
   - waitlist promotions from the last `promotionNoticeHours` (24 h).

   Each activity and kind appears once, in that order.
3. **Live activities** (`liveActivities`). One highlighted card per running activity, merging all of its courts. If the member is on court, the card names the court, partner and opponents. Otherwise it shows a resting hint.
4. **Recently ended** (`recentlyEnded`). Activities that ended in the last `recentlyEndedHours` (5 h), or that the organiser ended early. While the member may still vote (`canCastAwardVote`) and has not voted, the card offers the MVP vote. Otherwise it links to the results.

When nothing applies, a quiet empty state links to the Activities tab. The component re-evaluates every 15 seconds, so cards appear and expire on time without reloading.

## Activities tab (`groupEvents`)

Upcoming activities are split into:

- **Signed up** (first group): activities with an active (not cancelled) registration of the member;
- **Open for sign-up**: open for sign-up and before the deadline;
- **Other activities**: everything else upcoming, such as locked or full activities.

Ended and cancelled activities are collapsed under a **history** disclosure, newest first.

## Toasts in the ink-wash theme

`app/wuxia-toast.css` restyles Sonner toasts under `html.wuxia-theme`: a rice-paper background, square corners, serif type, and a thick left edge in the theme's pigments (green for success, cinnabar for errors and plain toasts, ochre for warnings). The classic theme keeps its existing colours.
