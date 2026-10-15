# Published lineup edits

Activity creators and administrators can exchange players in unscored planned matches, including records that carry legacy automatic playing/start metadata. Planned editing has no operation-time window: before the activity, after estimated starts and after the activity end, the same unscored plan can be adjusted. The UI shows pending score and ended states rather than an independently started phase.

The planned bench includes enabled, confirmed participants registered for the round's venue, including temporary guests. Arrival/departure windows and current occupancy do not reject a planned swap. Existing recorded results, cancelled matches and forfeits remain protected. One person cannot occupy two positions in a round; fixed-partner definitions remain separate from manual group locking.

Group locking has been retired. No lock control or lock badge is displayed, old lock API commands are rejected without changes, and stored legacy lock flags do not prevent swaps, draft court changes or regeneration. New generated matches keep the compatibility field false.

The UI snapshots the lineup for concurrency control; the API saves atomically. An old score dialog cannot award a result to substituted players, and a score saved first prevents a later stale substitution. Automatic court metadata, role authorization, scores, ranking replay and currency are not fabricated by a lineup edit. Other scheduling modes retain their own start/occupancy rules.

Regression coverage includes legacy playing/locked plans, before-start and after-end edits, score protection, stale dialogs, racing edits, SQLite rollback, role and venue restrictions, and absence of lock controls. Tests use fictional data only.
