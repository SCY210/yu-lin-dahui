# Add another match after a preplanned points schedule

After all existing planned rounds finish, activity managers can use Add next match.
The server appends one draft round, with one match per currently usable court.
The normal draft review, publish and start controls remain available. The planned
mode, old rounds, results, participants and fixed partners are preserved.

The command uses the current time and the previous round duration (clipped to the
remaining activity window), without asking for start or end times. It extends the
points window only as needed for the new round. Singles and doubles use their
existing grouping algorithms, attendance/court eligibility and fairness history.

Unfinished rounds, live or round mode, practice, tournaments, deleted or inactive
activities, fewer than five remaining minutes, or unavailable players/courts are
rejected. The displayed round ID snapshot and the API revision/request receipt
protect against stale or concurrent duplicate additions. Failed proposals leave
all history and event settings unchanged. The administrator simulation supports
the same command in its isolated store.
