# Quarterly leaderboard

The default leaderboard now uses Madrid calendar quarters: Q1 January–March, Q2 April–June, Q3 July–September, Q4 October–December. The selector provides previous/next quarters, year browsing and four labelled quarter choices. Annual ranking remains available.

Since `elo-v1`, quarter points are the sum of the player's 段位分 (Elo) changes from the quarter's rated games, plus owner grants on the combined board (see [REALM_PROGRESSION.md](REALM_PROGRESSION.md)). The stored monthly `win`/`loss`/`cap` season values are kept but no longer drive points, and there is no game cap; historical quarters are recomputed from the existing matches. Points stay live: games of a running activity count immediately and are flagged as pending, while visible realms wait for the activity to end. Match records, stored seasons and the hidden Elo are unchanged. The internal `monthly` and `elo` match flags remain the eligibility flags.

Only completed matches count, using actual start time in Europe/Madrid; ending in another quarter does not move the result. Friendly and applied-handicap matches remain in actual-match totals but not scored totals. Rate and average margin are calculated from the whole quarter's scored games, rather than averaging monthly rates. Ties preserve the existing points/rate/margin comparison and competition ranks. All enabled players appear, including those with no scored games.

The authenticated club response adds `quarterlyLeaderboard` and `rankingQuarter`. Its existing selected-month and annual fields remain compatible with historical-rule and social-summary consumers. Quarter selection uses a representative month internally. Conditional-read scope already includes that month and year, so different quarter selections cannot reuse a stale validator. Members continue to receive no raw rating numbers.

Ranking, home sidebar and My points now display quarter results. Profile navigation preserves quarter selection and scroll; legacy monthly history markers map to the corresponding quarterly view. The calculation panel explains the 段位分 rule (the old per-month rule list was removed).

A combined/singles switch sits below the quarterly/annual switch. The combined board is this unchanged leaderboard (all website matches plus owner grants); the singles board applies the same quarter/annual aggregation to 1v1 matches only, through `singlesQuarterlyLeaderboard` and `singlesAnnualLeaderboard`. See [SINGLES_RANKING.md](SINGLES_RANKING.md).

Validation covers all quarter mappings, Madrid midnight/year boundaries, cross-quarter endings, ignored historical caps/rules, friendly/uncounted games, weighted rates/margins, ties and disabled/empty players, annual-versus-four-quarter totals, and profile/history restoration. No database migration is required.
