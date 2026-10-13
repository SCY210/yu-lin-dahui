# Social features

Post-match voting now consists only of MVP. Eligible participants, activity creators and administrators have one vote per activity, may change or withdraw their choice, and cannot vote for themselves. The activity must have concluded and must not be cancelled. Late score entry does not prevent voting. See [MVP-only voting](MVP_ONLY_VOTING.md).

Style-tag voting and other award categories are retired. Their historical rows remain stored but are not displayed or writable through current voting commands.

Player profiles, recorded match statistics, partner/opponent relationships, challenges, activity photos, racket photos and owner-controlled profile editing retain their existing behavior. Automatically calculated relationship highlights are match statistics rather than votes. Social voting does not add leaderboard points or alter Elo, realms, expense allocations or permissions.

Verification includes the activity-voting unit suite and isolated SQLite award API tests covering eligibility, one-vote replacement/withdrawal, stale withdrawal protection, self/outsider rejection, activity boundaries, privacy, rollback and legacy-record preservation.

Season points and long-term realm ratings remain separate. Rated games earn 3 points for a win and lose 1 point for a loss, with the documented upset bonus. Grouping uses the realm-rating formula over doubles only; applied handicap games do not earn season or realm points. See [realm progression](REALM_PROGRESSION.md).
