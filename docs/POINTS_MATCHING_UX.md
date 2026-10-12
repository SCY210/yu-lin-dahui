# Points competition flow and compact courts

- Mobile match cards show two courts side by side. Nicknames stay on one horizontal line with accessible full names; swap controls no longer narrow the names. Completed results have a distinct completed label and winner treatment, with completed history grouped below active courts.
- The server reconciles due points sessions from authoritative activity/points times. Published rounds start when due; unconfirmed drafts stay drafts. Ended, cancelled, deleted, tournament and practice activities are excluded, and an explicit live pause is respected. After a sleeping device reconnects, state catches up on its next authorized request; it does not require a browser to send a start command.
- Planned schedules can append one round without replacing prior rounds, scores or planned times. Availability, courts, selected pairing and the end of the activity still constrain the added round. A round snapshot protects concurrent/repeated appends.
- Voluntary stop-playing is stored per activity and excludes the player from later matching without a loss, fee change or cancellation of their current game. The player, proxy registrant or event manager can resume participation. Pending published lineups involving a stopped player are identified for adjustment before starting; historical and current matches are preserved.

## Notice confirmation

An account that has never explicitly confirmed the participation notice is still asked once on entry. Existing valid confirmation is retained across visits and notice updates; old records never claim agreement to newer text.

Signup and signup edits, including proxy/guest signup, no longer ask for another notice checkbox and do not add a signup consent record. Historical signup confirmation records remain readable under the same recipient/manager permissions. Notice version `2026-10-12-v4` describes this behavior; historical entry confirmation still counts as previously confirmed without pretending to accept the updated text. Upload-specific rights confirmation is unchanged. The notice remains available from the activity and account pages.
