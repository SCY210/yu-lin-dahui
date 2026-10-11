# Visible friend signup entries

The friend creation endpoint and ordinary-member proxy signup permission remain enabled. Their UI entry was below the courts inside the collapsed friend section, while the primary court button combined personal editing and proxy signup. This made friend registration difficult to discover after the compact layout update.

The signup header now includes Add friend without expanding another section. Every court has a separate Register a friend action. It opens the existing court registration dialog with an owned friend selected and excludes the current player from that proxy selector. If there are no enabled proxy candidates, it opens the existing friend creation form and explains how to select that friend on the chosen court after saving. Existing friends can be registered directly. The primary personal-signup action is labelled separately.

Ordinary members see only their own enabled proxy players; activity managers retain their existing broader registration scope. This change does not relax ownership, capacity, waitlist, cancellation, or activity-time validation. Full courts continue to queue a friend normally. Creating a friend profile alone does not occupy a place.

Validation includes actual component interaction through the collapsed-roster layout, ordinary-member proxy selection, the no-friend creation entry, and server-domain tests for ownership, successful registration and full-court waitlisting.
