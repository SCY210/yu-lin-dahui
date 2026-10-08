# Mobile back navigation and application history

ClubNavigation records home, event lists/details/tabs, rankings, personal/admin pages, player lists/profiles, and social tabs in browser history. This replaces navigation that changed only React state and caused Back to leave the website immediately.

- New internal destinations use pushState; repeated selection of the same destination does not add entries.
- popstate restores the destination, event tab, profile, and scroll position without pushing another record.
- Initial navigation uses replaceState. Home adds no synthetic interception entries; returning to a previous website still works.
- Query parameters restore deep links on reload, including existing ?event=ID links. Missing/inaccessible entities fall back to the appropriate list; members opening administration fall back to their personal page.
- Returning to lists searches actual history. A direct detail link with no list entry replaces the destination to avoid a back/forward loop.
- Dialogs record an anonymous dialog ID so Back closes them first. Passwords, form contents, photos, and personal data never enter history.state. Forward does not resurrect a closed form.
- Dialog history.go and immediate subsequent navigation run in order. Microtask-delayed registration avoids duplicate entries during React effect replay.
- Account/mount session ownership isolates history markers. Reloads restore from URLs and rotate the generation; another account's old markers return home. Logout clears the current route.
- Existing external map/photo links retain their behavior.

Run node scripts/test-navigation.mjs for focused navigation regressions and npm test for the full suite. Test real-device Back/Forward, deep links, scroll restoration, modal dismissal, and account switching when changing this flow. Screenshots and per-run evidence belong in ignored output directories.
