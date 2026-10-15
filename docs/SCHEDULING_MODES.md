# Activity scheduling modes

Singles and doubles offer three persistent modes: planned schedule, one round after each completed round, and live per-court scheduling. Practice activities keep signup and fees without competition.

The creator or an administrator switches modes through a confirmation carrying the expected mode and pending match IDs. A stale request is rejected. Switching disables live auto-advance and cancels only unstarted draft/published matches from the old arrangement. Completed scores, started matches, attendance, fees and rest preferences remain unchanged. No production records are rewritten by deployment.

Legacy activities infer their mode from enabled live play, existing planned rounds, or existing ordinary rounds. Historical planned schedules therefore remain visible. Ended activities are read-only for scheduling.

Planned round headings show the round number and status without an estimated start time. Stored timestamps, round ordering and scheduling behavior are preserved; planning forms and the other modes retain their time controls.

Planned mode restores multi-round creation, draft swaps/court changes, batch publishing, ordered starts, rest rosters, profiles and score entry. After all current games finish, the host can plan remaining time after the current clock without replacing completed games. One-round mode exposes generation only after current games and pending rounds are resolved. Live mode retains independent score-triggered advancement, bench priority, manual lineup correction and voluntary rest. Selecting live mode does not start games; the host explicitly starts live scheduling during the activity.

After games have finished, remaining-time replanning keeps the confirmed partner mode; existing fixed teams are reused rather than reassigned from changed ratings.

Cancelled arrangements remain available in a read-only archive in all modes. Removing the last pending round does not unexpectedly change the inferred mode of a legacy activity.

Planned lineups remain editable until a score is stored, including legacy automatically started records. Their public state is pending score or ended; scheduler metadata does not block substitutions. Group locking is retired, and old stored lock flags do not restrict edits or generation.
