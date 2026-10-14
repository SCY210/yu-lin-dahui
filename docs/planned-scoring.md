# Activity ranking policy

Only the club owner and administrators can enable ranked play. New member-created activities are ordinary activities; they retain signup, court fees, grouping, all scheduling modes and score recording, but results do not affect season points, cultivation or grouping ratings. MVP awards and lateness adjustments also do not add or subtract points in ordinary activities.

Admin/owner creation can select ranked or ordinary play. The activity-level `eventRanking` command checks stored authority and the expected previous setting. It may update pending lineups before any match has started or received scores. Once play has begun, or the activity has ended/cancelled, its ranking setting is frozen. Individual start/score/handicap requests cannot override it. Practice remains unranked and does not generate matches.

Ranked activities keep the existing per-game rules, including separate singles/doubles boards, handicap exclusions and the cultivation settlement boundary. See [REALM_PROGRESSION.md](REALM_PROGRESSION.md). Ordinary results are excluded again during leaderboard and cultivation replay even if stale match flags incorrectly claim ranking is enabled.

The idempotent `admins-v1` maintenance upgrade classifies previously unflagged activities. Unplayed activities with a known ordinary-member creator become ordinary; ended activities, activities with started/results history, unknown legacy creators and administrator-created activities retain their previous ranked behavior. No historical score or earned result is rewritten. Event/settings payloads use existing JSON storage, so no SQL schema migration is required.

The earlier `enableAllRanked` migration is retained for legacy recovery and now respects explicitly ordinary activities. Tests cover direct commands and real SQLite handlers, forged enable/scoring requests, all three scheduling modes, MVP/lateness exclusion, replay safeguards, stale settings, duplicate requests, transaction failure/retry, UI controls and preservation of historical results.
