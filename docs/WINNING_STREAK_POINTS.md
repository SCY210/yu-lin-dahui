# Winning streak points

Season rankings reward consecutive rated game wins in addition to the existing win/loss and upset points. The award belongs to each individual player, including each doubles partner, and is determined from recorded results rather than a client-supplied streak.

| Consecutive rated win | Base win points | Additional streak points | Total before upset points |
| --- | ---: | ---: | ---: |
| First | 3 | 0 | 3 |
| Second | 3 | 1 | 4 |
| Third | 3 | 2 | 5 |
| Fourth and each later win | 3 | 3 | 6 |

The maximum **streak bonus** is 3 per winning game. The existing upset bonus can be added on the same game. Losses still deduct 1 point and reset that player's streak in the relevant format. A run of five wins with no upset bonus earns 24 points: 3 + 4 + 5 + 6 + 6. A subsequent loss ends the run; the next win starts at 3 again.

## Scope and replay

Singles and doubles streaks are independent, and changing a doubles partner does not reset a personal doubles streak. Streaks carry across activities and months within one Madrid calendar quarter, but start over at the next quarter. Annual totals add the four quarterly totals; the internal monthly compatibility view uses earlier games in the same quarter to determine a game's streak award, so monthly totals remain additive.

Each completed rated game counts separately, including individual games in a best-of-three match. Replay uses the existing canonical ordering: match finish time, match ID, then game index. Quarter attribution follows the actual match start time in Madrid, including matches that finish after a quarter boundary. Counter scopes are separate, so an older-quarter match finishing later cannot reset a newer-quarter streak.

Ordinary/unranked activities, friendly games, applied-handicap games, cancelled matches, unfinished results, future results and practice activities are excluded from the rated sequence; they neither advance nor reset it. Ordinary activities remain excluded even if old match flags claim ranking is enabled. A rated no-show loss resets only the absent player's streak. Present participants receive no fabricated win or loss.

Correcting or voiding a past result automatically rebuilds downstream streak awards and ranking positions. Completed games in a running activity receive their points immediately, including streak points in the pending subtotal. Activity settlement does not award them a second time. Historical boards also use the current policy; original results are preserved.

Long-term Elo, realm progression, matchmaking strength, attendance deductions, MVP awards and manual adjustments keep their existing calculations. The ranking row exposes `streakPoints` as a breakdown already included in `matchPoints` and `points`. Detailed ranking mode shows the streak subtotal, while the rules disclosure and guides explain the cap and reset conditions.

## On-fire avatar border

Members with at least two consecutive rated wins in either format in the **current** Madrid quarter display an orange/gold flame border around their avatar, including the profile, ranking and activity views that use the common Avatar component. The title/accessible image description identifies the active singles and/or doubles run. The state follows the same replay as bonus points, not the broader social-form statistic. A loss resets the affected format; an independently active streak in the other format can still keep the border lit. Correcting/voiding results and moving into a new quarter update it automatically. Selecting a historical ranking period does not resurrect an old fire border.

Guest/friend profiles and disabled players receive no fire state. Results of another member's hidden draft cannot reveal a private streak through the decoration. The border is original SVG/CSS: asymmetric orange flame tongues rise independently around the rim, with yellow-white cores, a warm glow and drifting embers. A circular mask keeps the face clear. It preserves uploaded-avatar fallback and existing sizes, and never intercepts clicks. Flames, glow and embers pause offscreen or when the page is hidden; the device's reduced-motion preference keeps a static flame border without embers. Conditional-read metadata expires at the Madrid quarter boundary so the decoration cannot survive a reset through a stale validator.

No database migration or stored bonus ledger is required. The implementation reads authoritative rated-game facts, never mutates match history, and uses one shared policy for calculations and explanations. Unit coverage exercises the cap, upset stacking, loss resets, individual games, score correction/voiding, separate formats, quarter/month/annual consistency, exclusions, no-show handling, pending points and deterministic replay. API/UI coverage verifies the projected ranking and displayed rules.

Validate with `npm run verify`, synchronize this independent feature branch to GitHub, and release approved shared changes through the controlled private Cloudflare workflow. Do not deploy a public-only build over private production.
