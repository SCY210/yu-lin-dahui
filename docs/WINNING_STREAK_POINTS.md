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

> **Redesigned in a cultivation style.** Each tier, chosen by the longer of the two streaks, has its own motif and its own word on the count seal. 2–3 wins: a breathing jade qi ring, two drifting auspicious clouds and rising motes, seal "lian sheng" (wins in a row). 4–5 wins: a double gold frame circled by three flying swords trailing sword light, seal "lian zhan" (cut after cut). 6 or more: a violet-gold bagua array of the eight trigrams turning behind the avatar, a counter-turning rune ring and thunder crackling at two corners, seal "lian ba" (unbroken reign). The tooltip names the tier. The frame follows the avatar shape: round in the classic theme and square in the ink-wash theme, which also uses mineral colours and square serif seals. The seal sits centred under the avatar, so it never reaches the name or realm tag beside it, and hides on avatars narrower than 35px. The bagua octagon stays upright while its trigrams and rune ring turn. Motion still pauses offscreen and in the background, and stops under reduced motion. Every tier is animated: a band of light flows along the frame in the tier's colour, the clouds drift, the swords and the bagua array turn, and a glint sweeps the seal. The seal uses its own spans with fixed size, weight, colour and font family, so ranking rows and the podium cannot enlarge or fade it. The paragraphs below describe the rules, which are unchanged.

Members with at least two consecutive rated wins in either format in the **current** Madrid quarter display an orange/gold flame border around their avatar, including the profile, ranking and activity views that use the common Avatar component. The title/accessible image description identifies the active singles and/or doubles run. The state follows the same replay as bonus points, not the broader social-form statistic. A loss resets the affected format; an independently active streak in the other format can still keep the border lit. Correcting/voiding results and moving into a new quarter update it automatically. Selecting a historical ranking period does not resurrect an old fire border.

Guest/friend profiles and disabled players receive no fire state. Results of another member's hidden draft cannot reveal a private streak through the decoration. The border is original SVG/CSS, preserves uploaded-avatar fallback and existing sizes, and never intercepts clicks. Flicker stops offscreen or when the page is hidden; the device's reduced-motion preference keeps a static flame border. Conditional-read metadata expires at the Madrid quarter boundary so the decoration cannot survive a reset through a stale validator.

No database migration or stored bonus ledger is required. The implementation reads authoritative rated-game facts, never mutates match history, and uses one shared policy for calculations and explanations. Unit coverage exercises the cap, upset stacking, loss resets, individual games, score correction/voiding, separate formats, quarter/month/annual consistency, exclusions, no-show handling, pending points and deterministic replay. API/UI coverage verifies the projected ranking and displayed rules.

Validate with `npm run verify`, synchronize this independent feature branch to GitHub, and release approved shared changes through the controlled private Cloudflare workflow. Do not deploy a public-only build over private production.

## Losing-streak avatar weather

Members whose live run is two or more consecutive rated losses get weather over their avatar instead. It is decoration only: season points, upset bonuses and Elo are unchanged, and each loss still counts -1. The run uses the same rated sequence, replay order, format scope and quarter reset as the winning streak; a win ends it. Disabled players and guests get none, and hidden drafts cannot reveal it.

| Losses | Tier | Look | Seal |
| ---: | --- | --- | --- |
| 2–3 | dark clouds overhead | a grey cloud drifts above the avatar with light drizzle; the photo is slightly greyed | "N lian bai" |
| 4–5 | wind and rain | a dark storm cloud, slanting rain and flashes inside the cloud | "N lian gui" |
| 6+ | heavenly tribulation | a violet-black tribulation cloud turns above; lightning strikes the avatar, which flashes white and shakes a little | "du jie N" |

Colours follow the theme (cool greys in the classic theme, ink greys in the ink-wash theme). The seal uses the same placement and fixed type as the winning seal, and motion pauses offscreen, in the background and under reduced motion. Tests: `tests/losing-streak.test.ts` and `tests/avatar-fire-ui.mjs`.

## Live state

Avatar signs show the player's live state, not history: only the format of their most recent rated game in the current quarter counts. If a player won two singles games and then lost a doubles game, the singles winning sign disappears and the doubles count starts; when they return to singles and win, the still-unbroken singles run shows again. Season-point streak bonuses are unchanged and stay per format. Implemented by `latestRatedFormats` and `liveStreak` in `lib/domain/season-points.ts`; covered in `tests/losing-streak.test.ts`.
