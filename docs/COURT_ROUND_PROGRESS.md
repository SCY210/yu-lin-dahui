# Per-court progress through published rounds

Recording a final score immediately starts the next published match on that physical court, in the same saved transaction. It does not wait for the other courts or for the next round's estimated start time. Each started match records its actual start time. Round estimates remain planning aids.

A round remains in progress while any of its courts are playing or waiting after play has started. It is completed only when every match is completed, forfeited or cancelled. Several rounds can therefore be in progress simultaneously. The activity screen shows the number of finished and currently playing courts for each round.

Only the earliest unfinished match on a court can start. Confirmed players must be available at the current time, within their signup and booking, and not playing on another court or in another activity. Physical court aliases share the same occupancy check. A blocked lineup waits without changing its published teams; untouched matches can still be edited within a partly started round. Completed and playing lineups remain protected.

Drafts are never published implicitly, and an earlier draft cannot be skipped on its court. Early-entered results with future end times do not release a court prematurely. Future, ended, deleted, cancelled, practice and tournament activities do not use this continuation. Fixed partners, singles/doubles formats and event ranking permissions remain authoritative.

Existing real-time court filling is retained. The round-by-round mode still creates new rounds on explicit request; this change starts already published next matches and does not invent additional rounds after a plan finishes. Planned activities retain the append-one-round control.

Score corrections and identical retries do not restart following matches. Concurrent scores on different courts are reconciled by the existing score snapshots and database revision checks. A failed transaction rolls back the score and its automatic starts together. Read maintenance recovers pending courts when attendance or booking availability changes; its read-only eligibility guard avoids cloning unchanged club history. Future forfeited end times now expire conditional-read validators, alongside existing result, booking and attendance boundaries.

Validation covers two courts progressing at different rates, overlapping rounds, busy players, physical court aliases, drafts, arrivals and conditional-read boundaries, fixed teams, singles, ordinary-event scoring flags, SQL rollback and simultaneous score submissions. No production business data is used.
