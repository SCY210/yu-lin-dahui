# My page controls

Achievements are collapsed by default on My. The visible View achievements button mounts the collection on its first activation; later collapse/reopen preserves its selected filter and achievement. Personal badge images load eagerly only after the collection is opened; other player collections keep lazy image loading. The latest confirmed personal fee split is shown first, with earlier activities behind one history disclosure. Each activity uses its highest confirmed version, excluding drafts.

The bond board (`app/bond-board.tsx`, see `docs/BONDS.md`) follows recent matches.

My ends with one settings card (`MySettings`, `extra`). It holds the account/password and notifications/install buttons; for administrators it adds the administrator settings and data export; and it ends with sign-out. The card follows recent matches and the bond board. Only the selected settings panel mounts; clicking the active button closes it. Existing account, password, push notification, and installation flows retain their behavior and permissions. Panel state resets when the account changes or My is left.

## Compact layout

My is laid out to show more at once on a phone (`app/me-panels.css`, scoped under the club shell):

- **Profile card.** The My profile link sits with the avatar and name actions, instead of on a row of its own.
- **Stat tiles.** These use smaller padding and type. The activities tile shows its count with a short unit; its counting note moved to a tooltip.
- **Section cards.** The realm, achievements, fees and settings cards use tighter spacing.
- **Bond board.** It shows the first three members; the show-all button lists the rest.

On a 390 px preview the page went from about 2040 to about 1500 px tall. The first screen now reaches recent matches.

