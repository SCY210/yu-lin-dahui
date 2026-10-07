# Animated cultivation badges

Profiles, social player cards and ranking rows share the five realm insignia from `app/realm-badge.tsx`. The badge reads the existing realm and stage; it does not change strength, progress, points or the initial 炼气 · 初期 · 0% rule.

The My page also displays this badge through `app/my-realm-card.tsx`, using the existing cultivation realm, stage and progress. On phones its realm card spans both statistic columns so the badge remains readable; points and attendance remain below it. This preserves the compact account panels and does not change growth calculations.

The shared presentation uses a larger illuminated medallion, a quiet beveled surface and steady, high-contrast lettering. Qi Refining has a flowing wisp; Foundation has staggered crystal layers; Golden Core has a luminous orb and orbit; Nascent Soul has a lotus and light seed; Spirit Transformation has a radiating eye. Blue, periwinkle, champagne, violet and rose-white distinguish the realms. Circuits turn slowly, without scaling or animating the realm text. Ranking rows use a compact 28px insignia; the My page uses 48px (42px on phones).

The decorations pause when a badge leaves the viewport or the document is hidden. Observers and visibility listeners are removed on unmount. Without IntersectionObserver, visible-page animations remain available. Server-rendered badges start paused until visibility is known.

`prefers-reduced-motion: reduce` removes all decorative SVG animation and hover transitions, keeping the full static insignia visible. Fixed SVG geometry transforms remain intact so lotus petals do not overlap. Foundation bars and spirit rays use per-element CSS delays so their staggered effects survive the animation declarations.

The dependency lock matches the unchanged main-branch package manifest; no dependency upgrade is needed for the badges. Verify a clean `npm ci`, unit/API regressions, type checking and production build. Browser verification covers 320px and 390px layouts, normal and reduced-motion CSS, staggered delays, and offscreen animation pauses using fictional data.
