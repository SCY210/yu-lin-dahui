# 月度排行榜领奖台

`app/ranking-podium.tsx` exports `RankingPodium({leaders, players, onProfile})` and imports its own scoped `app/ranking-podium.css`.

Pass the existing `rows.filter(r => r.games > 0 && r.rank <= 3).slice(0, 3)` as `leaders`, `data.players` as `players`, and the existing profile callback as `onProfile`. No ranking or points computation changes.

- The first supplied player occupies the raised center, second lower left, third lower right. This 2–1–3 layout remains at 390px and 320px; columns never stack.
- Avatar and player name are a native button when `onProfile` is supplied. The shared `Avatar` preserves photo loading and Unicode initial fallback. Without a callback, player information is static.
- Gold, silver, and bronze SVG medals sit below the name, points, and wins/losses, above metallic pedestal numbers. No generated imagery or external assets are needed.
- Both the medal metal and visible pedestal number use the original `row.rank`. A 1,1,3 tie shows two gold medals and actual 1,1,3 labels, with “并列” when a rank repeats in the supplied leaders. No synthetic second place is assigned.
- At most three supplied records are shown. Missing records produce neutral empty pedestals without fabricated names, medals, or rank numbers. An empty leaders array returns `null`.
- Names wrap without ellipsis. Buttons exceed the 44px touch target, have visible keyboard focus, and disable transitions for reduced motion preferences.

All new CSS classes use `rp-*`; the implementation avoids the existing `podium-card` cascade. Integration, application checks, and browser/mobile QA are performed by the parent task.

已接入月榜，显示冠军 / 亚军 / 季军及对应奖牌。390px和320px浏览器验收确认：冠军横向居中并高于两侧，奖牌位于比赛成绩下方；领奖台数字未裁切，没有页面横向溢出。并列称号与奖牌依据实际rank，排名算法、积分、头像档案入口及全部排名列表保持原行为。TypeScript和生产构建由主任务检查，验收截图保存为preview-captures/podium-mobile.png。
