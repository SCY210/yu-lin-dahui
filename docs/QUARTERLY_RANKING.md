# Quarterly leaderboard

The default leaderboard now uses Madrid calendar quarters: Q1 January–March, Q2 April–June, Q3 July–September, Q4 October–December. The selector provides previous/next quarters, year browsing and four labelled quarter choices. Annual ranking remains available.

Quarter points sum the three months' existing scored results. Each month retains its saved historical win/loss rules and per-player cap; absent monthly rules fall back to current club rules. Caps reset monthly, with no extra quarter cap. This display change does not alter match records, stored seasons, Elo, or historical month/annual calculations. The internal `monthly` match flag remains the ranking eligibility flag.

Only completed matches count, using actual start time in Europe/Madrid; ending in another quarter does not move the result. Friendly matches and matches exceeding their monthly cap remain in actual-match totals but not scored totals. Rate and average margin are calculated from the whole quarter's scored games, rather than averaging monthly rates. Ties preserve the existing points/rate/margin comparison and competition ranks. All enabled players appear, including those with no scored games.

The authenticated club response adds `quarterlyLeaderboard` and `rankingQuarter`. Its existing selected-month and annual fields remain compatible with historical-rule and social-summary consumers. Quarter selection uses a representative month internally. Conditional-read scope already includes that month and year, so different quarter selections cannot reuse a stale validator. Members continue to receive no raw rating numbers.

Ranking, home sidebar and My points now display quarter results. Profile navigation preserves quarter selection and scroll; legacy monthly history markers map to the corresponding quarterly view. The calculation panel lists the quarter's three monthly rule sets.

A combined/singles switch sits below the quarterly/annual switch. The combined board is this unchanged leaderboard (all website matches plus owner grants); the singles board applies the same quarter/annual aggregation to 1v1 matches only, through `singlesQuarterlyLeaderboard` and `singlesAnnualLeaderboard`. See [SINGLES_RANKING.md](SINGLES_RANKING.md).

Validation covers all quarter mappings, Madrid midnight/year boundaries, cross-quarter endings, different historical caps/rules, friendly/uncounted games, weighted rates/margins, ties and disabled/empty players, annual-versus-four-quarter totals, and profile/history restoration. No database migration is required.
