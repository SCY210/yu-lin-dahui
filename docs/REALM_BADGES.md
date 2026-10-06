# Animated cultivation badges

Profiles, social player cards and ranking rows share the five realm insignia from `app/realm-badge.tsx`. The badge reads the existing realm and stage; it does not change strength, progress, points or the initial 炼气 · 初期 · 0% rule.

The decorations pause when a badge leaves the viewport or the document is hidden. Observers and visibility listeners are removed on unmount. Without IntersectionObserver, visible-page animations remain available. Server-rendered badges start paused until visibility is known.

`prefers-reduced-motion: reduce` removes decorative animation and hover movement completely, keeping the full static insignia visible. Foundation bars and spirit rays use per-element CSS delays so their staggered effects survive the animation declarations.

The dependency lock matches the unchanged main-branch package manifest; no dependency upgrade is needed for the badges. Verify a clean `npm ci`, unit/API regressions, type checking and production build. Browser verification covers 320px and 390px layouts, normal and reduced-motion CSS, staggered delays, and offscreen animation pauses using fictional data.
