# Monthly ranking podium

app/ranking-podium.tsx exports RankingPodium({leaders, players, onProfile}) with scoped app/ranking-podium.css.

Supply the existing rows.filter(r => r.games > 0 && r.rank <= 3).slice(0, 3), data.players, and profile callback. This component does not calculate points or ranks.

- The first supplied player is raised in the center, second is left, third is right. The 2-1-3 layout stays horizontal at 390px and 320px.
- Avatar/name become a native button with onProfile. Shared Avatar handles photos and Unicode initial fallback. Without a callback, player information is static.
- Gold/silver/bronze SVG medals appear below results and above metallic pedestal numbers. No external/generated assets are required.
- Medal and pedestal use row.rank. A 1,1,3 tie shows two gold medals and true rank labels; it does not invent second place.
- At most three records are shown. Missing records have neutral empty pedestals without fabricated names/medals/ranks. Empty leaders returns null.
- Names wrap, controls target at least 44px, focus remains visible, and reduced motion disables transitions.

rp-* styles avoid the previous podium-card cascade. Verify centering, elevation, medals, visible numbers, tie labels, profile links, and page overflow on narrow screens. Screenshots such as preview-captures/podium-mobile.png are ignored local evidence, not required source.
