# Initial cultivation realm

The default strength rating remains 1000. It now displays **炼气 · 初期 · 修为 0%** consistently in player profiles, social cards, the personal page, leaderboards and team realm labels. Existing players at that default and newly created players share the same starting realm.

Realm thresholds are 1100 (筑基), 1232 (金丹), 1300 (元婴), and 1380 (化神). The first progress bar starts at 1000; lower ratings display 0% without changing their stored strength. Progress within each realm is rounded down and bounded to 0–99%, resets at promotion, and displays 100% at the highest realm.

This changes presentation thresholds only. It does not reset player ratings, initial ratings, matches, rating changes, points, grouping or the Elo calculation. A first equal-strength win with K=32 still adds 16 rating points and now displays 16% progress in 炼气. Losses continue to affect strength; friendly matches do not add rated progress.

Regression coverage checks default players across monthly, quarterly, annual and member-facing projections; unchanged source state and ranking points; realm boundaries; actual match progression and historical replay.
