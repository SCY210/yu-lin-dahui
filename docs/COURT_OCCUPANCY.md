# Court signup coverage

Only the activity creator sees the court-coverage section on the activity signup page. The server derives `canViewCourtOccupancy` for each event from its stored creator and the authenticated account; an administrator or club owner who did not create that activity gets no override. Legacy activities with no creator do not display it. Normal signup lists and signup permissions are unchanged.

The section includes a timeline for each booked court. It shows confirmed signup counts, empty intervals and their duration, and whether each interval has enough players for singles (two) or doubles (four). Practice requires one participant for the coverage display. Selecting an interval lists its players. Empty time is summed separately for each court.

This is planned signup coverage, not evidence of matches played, actual attendance or a financial settlement. Waitlisted and cancelled court signups do not fill gaps. Registration and waitlist-promotion times are respected. Court-specific signups stay on their court; legacy activity-wide signups cover overlapping court bookings. The display reuses `registrationSpans`, handles adjacent intervals without false gaps, and counts a player only once when legacy rows overlap.

The calculation runs in the client using already authorized activity data. It adds no server queries, persistent records, clock-driven API boundaries or writes. Changes to signups update the diagram through normal activity refresh. All themes use the same component and theme variables.

`tests/court-occupancy.test.ts` covers empty periods, fee-preview boundary agreement for current signups, exclusions, promotions, duplicate-player intervals, court isolation and legacy data. `tests/court-occupancy-ui.mjs` checks integration with the actual signup page, interval selection and updated registration props.
