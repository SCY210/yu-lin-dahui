# Animated cultivation badges

Profiles, social player cards, the personal page and ranking rows share the five realm insignia from `app/realm-badge.tsx`. The badge reads the existing realm and stage; it does not change strength, progress, points or the 段位分 realm rules (new players start at 1000, 金丹 · 初期). Realm order comes from `lib/domain/realm-rating.ts`.

The My page shows this badge through `app/my-realm-card.tsx`, using the existing 段位分 realm, stage and progress. On phones its realm card spans both statistic columns so the badge keeps its full row layout; points and attendance remain below it. This preserves the compact account panels and does not change 段位分 calculations.

## Look

Each badge is a pigment seal on a paper tag. The tag takes its paper from the active theme's `--card` colour and is only lightly washed with the realm pigment, so it sits inside each theme instead of floating above it. 水墨江湖 squares the tag corners and sets the realm name in brush script; the stage keeps the page font for legibility.

| 境界 | Pigment | Seal | Core art |
| --- | --- | --- | --- |
| 炼气 | 黛青 slate | octagonal stone | qi spiral drawing inward |
| 筑基 | 松翠 jade | hexagonal altar | three foundation courses settling in turn |
| 金丹 | 赤金 gold | twelve-ray sun | breathing golden core in a turning ring |
| 元婴 | 紫棠 violet | eight-petal lotus | nascent soul seated in the lotus |
| 化神 | 墨金 ink and gold | round medallion, gold rim | golden heavenly eye with 24 shimmering rays and crackling arcs |

The orbit around each seal carries one node per realm (1–5), so the tier stays readable even at 22px.

Stage text uses the deep realm ink with a small paper wash, preserving contrast on the light surfaces. Ranking names remain 14px and stage metadata 12px; the pigment wash must not replace the stage's deeper ink.

Every realm moves, and each realm adds splendour, so a higher realm is always visibly grander than a lower one:

| 境界 | Look and motion |
| --- | --- |
| 炼气 | plain paper tag; the qi spiral draws inward, the core breathes, the single orbit node drifts |
| 筑基 | plain paper tag; foundation courses rise in turn, the spirit pillar pulses, the orbit turns |
| 金丹 | gold-leaf tag; the sun seal turns, the pill ring and core move, the halo pulses with heat; the name glows warm gold; two embers rise; light passes over the tag |
| 元婴 | starlit violet tag; the name glows and breathes violet; orbit and lotus seat turn; spirit ripples spread and four motes rise beside the seal; light passes more often; violet aura |
| 化神 | ink thunderclouds lit with gold: pale ink clouds drift irregularly inside the tag and smoke wreathes its edges; two silver-gold bolts strike on unrelated rhythms with a double flicker and light the clouds; the gold name glows and flares with the strike; lightning arcs crackle round the heavenly-eye seal while its rays wheel; gold aura. One set of CSS variables on `.realm-badge-4` holds the whole storm palette |

Ranking-row progress bars follow the 水墨江湖 progress colours, and narrow progress labels wrap the percentage as a whole.

## Motion

The decorations pause when a badge leaves the viewport or the document is hidden. One shared IntersectionObserver serves all badges; observers and visibility listeners are removed on unmount. Without IntersectionObserver, visible-page animations remain available. Server-rendered badges start paused until visibility is known. SVG coordinates are rounded so server and browser markup match.

`prefers-reduced-motion: reduce` removes decorative animation completely, keeping the full static insignia visible: the spiral fully drawn, every foundation course and ray at full strength, no passing light, ripples, rising motes, lightning or arcs. 金丹 and 元婴 keep a static glowing name, and 化神 keeps its ink sky, still clouds and glowing gold name, so the ranking of ornament survives without motion. This follows the viewer's own system setting; everyone else sees every realm animated. Foundation courses and rays use per-element CSS delays so their staggered effects survive the animation declarations.

The dependency lock matches the unchanged main-branch package manifest; no dependency upgrade is needed for the badges. Verify a clean `npm ci`, unit/API regressions, type checking and production build. Browser verification covers 320px and 390px layouts in each theme, normal and reduced-motion CSS, staggered delays, and offscreen animation pauses using fictional data.
