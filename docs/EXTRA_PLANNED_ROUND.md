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

Unfinished rounds, live or round mode, practice, tournaments, deleted or inactive
activities, fewer than five remaining minutes, or unavailable players/courts are
rejected. The displayed round ID snapshot and the API revision/request receipt
protect against stale or concurrent duplicate additions. Failed proposals or start operations leave
all history and event settings unchanged. Regression tests use an isolated local
fictional fixture. The administrator simulation is also available for isolated manual scheduling checks with member snapshots.
