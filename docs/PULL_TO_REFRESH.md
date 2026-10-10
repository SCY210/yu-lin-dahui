# Pull to refresh

The home-screen app (iOS "Add to Home Screen" and other standalone installs) has no browser pull gesture, so a page
opened before a release keeps its old code and data until it is closed. `app/pull-to-refresh.tsx` adds the gesture
in standalone mode only; normal browser tabs keep their own behaviour.

- A pull starts only when the page is at the top, with one finger, outside dialogs, outside elements marked
  `data-no-pull-refresh` and not inside an inner scrolling area that is scrolled down (`pullBlocked`).
- Finger travel is halved and capped at 110 px. Past 72 px the indicator reads "release to refresh"; releasing
  reloads the page, which also loads a newly published version. A shorter pull springs back.
- While the indicator follows the finger, the page bounce is suppressed. The spinner respects reduced motion.

`tests/pull-to-refresh.test.ts` covers the damping, threshold and blocking rules.

A cancelled gesture never reloads. Adding a second finger or scrolling away from the top cancels the pull. Open dialogs and form controls retain their own touch handling. These cases are exercised by `tests/pull-refresh-ui.mjs`.
