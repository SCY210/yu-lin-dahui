# Add another match after a preplanned points schedule

After all existing planned rounds finish, activity managers can use Add next match.
The server appends and immediately starts one points round, with one match per
currently usable court. Adding, publishing and starting run in one atomic command;
no additional publish or start click is needed. Existing score and arrival controls
remain available. The planned
mode, old rounds, results, participants and fixed partners are preserved.

The command uses the current time and the previous round duration (clipped to the
remaining activity window), without asking for start or end times. It extends the
points window only as needed for the new round. Singles and doubles use their
existing grouping algorithms, attendance/court eligibility and fairness history.

Live or round mode, practice, tournaments, deleted or inactive activities, an
activity closed before its end, and unavailable players/courts are rejected. The displayed round ID snapshot and the API revision/request receipt
protect against stale or concurrent duplicate additions. Failed proposals or start operations leave
all history and event settings unchanged. Regression tests use an isolated local
fictional fixture. The administrator simulation is also available for isolated manual scheduling checks with member snapshots.

## Overtime

Once the rounds fill the activity's time, or after its scheduled end, the Add next match button gains an "overtime" label and keeps working. It no longer turns grey at the end.

- **Players and courts.** As in live play's overtime (`lib/domain/live-window.ts`), the final scheduled attendance and court phase supplies the players and courts. The round keeps the usual length and is marked `overtime`.
- **Checks.** Round checks (`validateRound`) evaluate any window that runs past the end against that final phase.
- **Starting.** Overtime rounds start only on explicit actions: adding the round, publishing, or a score that frees a court. Background maintenance never starts anything after the end, and an unstarted regular lineup does not hold a court in overtime.
- **Unchanged.** Booking, attendance and fee durations do not change. Match timestamps record the real time.
- **Early closure.** An activity closed early, with its status set to ended before the scheduled end, still refuses new rounds.

