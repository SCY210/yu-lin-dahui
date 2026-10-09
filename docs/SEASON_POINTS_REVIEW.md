# Season points review repairs

The season-point policy is now win 3 / loss −1 (changed from loss +1 so that a 5–0 run is clearly ahead of a 2–4 run), with a 1 or 2 point upset bonus at pre-game team-rating gaps of 50 or 150. Singles and doubles remain separate in the visible boards. The long-term realm-rating policy and proposed 150-point realm bands are retained.

Review regression tests exposed and repaired these integration cases:

- Three UTC calendar months clamp the original day to the target month's last day, preserving hours, seconds and milliseconds. January 31 becomes April 30, rather than rolling into May. Leap-year February is covered.
- Already migrated grouping strength is refreshed in memory on every authoritative load. The first rollout alone records its marker and audit; clock-driven inactivity catch-up does not create a new revision or erase historical matches, season points or manual adjustments.
- Conditional-read validators expire before inactivity deadlines, so an unchanged database revision cannot retain stale realm/placement data across that boundary.
- The deprecated monthly response field is retained for browser tabs opened before deployment. Current navigation still offers only quarterly/annual singles and doubles boards, and the compatibility rows retain normal privacy and guest filtering.
- The original clean-install validation exposed a 409 from an authentication fixture using a raw pre-migration revision. The author's concurrent update marks that fixture as already migrated and is preserved. Separate SQLite coverage exercises genuine first-time migration, its revision increment and idempotence.
- The merge preserves the latest home live-match cards and removal of the home quarterly preview.
- The author's later owner-only realm-rating adjustment is exercised through real SQLite handlers: score-only grants do not add season points, retries apply once, forged owner flags fail, and injected audit-write failures roll back rating changes too. Current MVP-only ballots and compact mobile sections remain covered.

Coverage includes failing-before/passing-after domain tests, actual SQLite maintenance and live-start handlers, and the existing whole-project verification suite. No production business data is used by tests.
