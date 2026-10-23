# Live court rotation

Each court advances independently. An authorized signed-up account records a single-game result, closing that game and recording any required break in the same optimistic, idempotent D1 transaction. The next game waits for the Start grouping button (`liveNext`), available to signed-up players, the organiser and administrators. Other courts keep playing.

No estimated duration is required. Signup windows, actual court bookings, enabled status, attendance and games already in progress still constrain eligibility. Starting live play preserves completed results and current games; unstarted planned rounds are cancelled. Planned scheduling and singles retain their established behavior.

## Doubles: winners stay, original matching algorithm

Available winners of the preceding live game retain their places on that physical court. The other places go to waiting players, prioritizing those who have not played, fewer appearances, an earlier previous turn and signup order. Losing players give up their places. If winners must rest or leave, the original bench still comes first and just-finished losers may fill the extra vacancies. This permits six-player rotation when both winners reach the limit.

The selected four use the existing strength, gender and match-history pairing cost. The winners may remain partners or be split; there is no forced split. Confirmed fixed partners stay together. Available winners are reserved for their own waiting court, so another court cannot consume them as substitutes. Winner retention takes precedence over exact equality of total appearances. Equal-priority substitute alternatives may improve the existing pairing cost.

A doubles court waits if four eligible players cannot be assembled. It never silently restarts the same four. The old doubles `allowSame` request flag cannot override substitution or mandatory breaks. Singles keep their existing bench rotation and explicit same-player option.

## Two personal wins require a break

The limit counts two consecutive wins per person during one stay on court, not two appearances or a fixed team's streak. New live rounds store the retained identities in `liveRetained`. A fresh turn from the bench starts a new run. Partner changes and cross-court swaps carry retained identity; another court starting or a transfer to an older in-progress game does not clear the win count.

The second win records a `win-limit` break in the activity's JSON. That player cannot be selected or swapped onto another court, marked ready early, or released by turning off the voluntary-rest preference. A later-started, completed scored game at the same venue releases the break. A simultaneous game that began before the break, a cancellation or a plain forfeit does not satisfy it.

Players and accounts managing proxy profiles may still request voluntary breaks. These last until a later-started game at the same venue ends, or the player explicitly marks themselves ready. Only voluntary breaks show the ready-again action; mandatory breaks show their two-win status. Organisers can pause selection without preventing current games from being scored.

## Current lineup corrections

Creators and administrators can exchange partners, a court player and a waiting player, or players on different courts before scoring. Fixed partners cannot be split. `liveSwap` validates the complete current lineup snapshot and every affected court before saving; a changed snapshot returns 409. The older `liveLineup` command validates both complete teams and remains supported. Identity, permissions, signup/venue eligibility, duplicates, other active games and breaks are checked on the server.

Corrections keep match IDs, courts and start times; they do not create results or new matches. Retained identity follows an on-court swap, while a player replaced from the bench starts a fresh run. Completed games cannot be edited through lineup commands. Score corrections do not retroactively recreate lineups or duplicate/release recorded breaks.

## Timing, compatibility and simulation

Previously unused courts still start automatically when the activity, court slot or player availability opens. Finished courts wait for the grouping button and are excluded from read-time automatic filling. No-show replacement remains a separate flow. Courts retain their numerical order on the page whether playing or waiting.

Visible activity pages keep three-second refreshes with hidden/offline suppression. Every break and release is tied to a scored write and changes the stored revision; this update introduces no new clock-only invalidation boundary. Optional JSON fields require no SQL migration. Existing games are not rewritten on deployment. Legacy rounds without retained markers start a fresh run when the new rule begins.

The isolated simulation uses the same commands and view. Its scores, retained identities and breaks remain in its own document; reset does not modify the real club. Tests cover retained/split/unchanged winning pairs, two-win enforcement, six-player rotation, overlapping courts, swaps, fixed teams, missing substitutes, score correction, persistence, scoped responses, rollback, idempotence and concurrent next-game requests.
