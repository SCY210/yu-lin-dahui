# Singles and doubles activities

Creation starts with Singles / Doubles, venue, start/end, capacity and the existing EUR 6.90 hourly court price control. A title is generated on the server from the Madrid date and format; users do not fill in a name. Court name, draft status and activity description are optional advanced settings. Existing activities without matchFormat remain doubles and keep their historical titles and records. automaticTitle distinguishes generated titles from legacy/custom titles.

## Match creation

Singles uses one player per side and two players per court. Doubles uses two per side and four per court. Live courts advance independently after scoring; availability, venue restrictions, equal appearances and optional breaks apply to both formats. A singles court waits when too few eligible players are available. Single-round generation and advance planning also support singles. Fixed-partner voting and doubles partner identities remain available only for doubles. Once any non-cancelled match has been scheduled, the activity format cannot change. Different formats cannot be merged.

## Separate boards

The ranking page offers Doubles / Singles together with Quarterly / Annual. The existing leaderboard, quarterlyLeaderboard and annualLeaderboard API fields now contain doubles matches only; the singles fields contain singles only. Singles still lists members with completed singles records in the selected period. Doubles keeps all enabled account-backed members and existing owner adjustments. Proxy guests remain excluded from both boards.

Points remain 1000 plus the selected format's rated-game realm-rating changes in the period. Singles changes do not enter the doubles board, or vice versa. Madrid start time determines month/quarter/year; best-of-three counts each game. Sorting, ties, immediate pending points and activity-end settlement retain the current rules. Owner adjustments belong to doubles only. The established shared visible realm rating is unchanged; this update separates board contributions, not the realm policy. Hidden doubles matchmaking Elo remains doubles-only. Internal combined domain helpers remain available for compatibility, but the member ranking UI displays the two separate formats.

## Modification forms

User-entered reason prose is no longer required. Forms and score corrections supply a short operation description automatically; domain commands accept omitted/blank reasons and save non-empty audit text. Actor identity, time, authorization, input limits, revisions, idempotence and transactional persistence remain enforced. Destructive actions retain their confirmation. Optional activity/signup descriptions remain available. Existing malformed grant records without saved audit text remain excluded from the durable adjustment ledger.

## Verification

Domain coverage includes automatic names and Madrid dates, two-player starts, multi-court fairness, breaks, single-round and planned scheduling, format immutability and existing doubles behavior. Isolated SQLite tests exercise real activity creation, signup, scoring, correction, separate boards, authorization, idempotence and rollback. Headless React tests exercise the actual edit/confirmation/score forms without a reason input. These tests never write production business data.
