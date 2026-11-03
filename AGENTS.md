# Project collaboration requirements

## Primary production destination (owner instruction, 2026-10-18)

- Cloudflare is the primary site: https://yu-lin-dahui.chenyueshanxd.workers.dev/. New approved PRs and feature updates publish through the controlled private Cloudflare workflow.
- The Sites-to-Cloudflare business-data copy was a one-time migration. Do not assume ongoing synchronization or overwrite either database during a code release.
- The separate Sites deployment remains a secondary entry. Do not automatically publish PRs to it, change its audience, or add redirects without an explicit owner request.

## Significant updates must be synchronized to GitHub

- The canonical repository is [SCY210/yu-lin-dahui](https://github.com/SCY210/yu-lin-dahui).
- Before finishing any significant update to core functionality, page flows, permissions, security, data structures, architecture, or deployment configuration, synchronize the relevant code, documentation, and necessary configuration to GitHub. Local changes or an updated deployed website alone are insufficient.
- Validate the update before synchronization. After synchronization, verify that the remote commit contains the changes and provide the commit or PR URL and status. If authentication, permissions, or networking prevent synchronization, explain the specific cause and clearly state that GitHub has not been updated.

## Commits and review

- The owner and Codex/assistants performing authorized work through the owner's SCY210 account may update main directly, without a separate PR or additional approval. Significant updates still require validation and GitHub synchronization.
- Except for the named exception below, invited collaborators must submit changes through a PR approved by SCY210 before merging into main. New commits require renewed review; collaborators must not push directly to main.
- The owner explicitly authorized zehang0228 to merge PRs into main without SCY210 approval. This user-specific ruleset bypass applies only through pull requests; it does not grant repository Admin, direct pushes to main, force pushes, branch deletion, or exemptions for other collaborators.
- GitHub enforces protection by account and permissions. Preserve the owner's existing exemption and the zehang0228 PR-only exception. Keep PR approval, Code Owners review, and stale-review dismissal for everyone else. Any additional collaborator exemption requires a new explicit owner instruction. See docs/GITHUB_REVIEW_POLICY.md for the verified configuration.
- PR submission permissions remain restricted to invited collaborators. The user must explicitly identify any new collaborator.
- Merge requirement for every PR: server changes must stay within the Cloudflare Workers CPU budget in docs/PERFORMANCE_BUDGET.md. The club is on Workers Paid (30 s of CPU per request, 30 million CPU milliseconds a month included), so there is no 10 ms limit any more, but polled reads must stay cheap: every phone polls every few seconds and CPU is billed beyond the monthly allowance. Rare one-off work, such as planning rounds again at a phase change, may take longer. Index data once instead of scanning the whole history per player, activity or match; share viewer-independent results per stored revision; prove optimized output is unchanged; register every new clock-driven change in the live conditional-read boundaries (lib/club-read-cache.ts, tests/live-conditional-read.test.ts); and keep tests/performance.test.ts passing in npm run verify. Do not loosen a performance budget to make a change pass.

## Shared documentation and local state

- Write new or rewritten shared Markdown documentation in English. Existing untranslated notes listed in scripts/legacy-markdown.json may retain their language; preserve their up-to-date behavior descriptions when resolving conflicts. This does not require translating the application UI, user data, test fixtures, or third-party license notices.
- Keep source code, reproducible tests, migrations, licenses, and required hosting configuration tracked.
- Keep personal agent/editor state, credentials, local databases, generated outputs, and per-checkout reports ignored.
- To stop tracking local files, preserve their contents and use git rm --cached. Never delete another contributor's local working files.
- Git may remove formerly tracked files when another checkout pulls a deletion. Document a backup procedure before merging such a change; ignoring a path alone does not preserve it during checkout.
- Legal notices must describe actual processing and real operator details. Do not invent identities, legal bases, consent, retention rules, or compliance guarantees.

## Privately customized material stays outside public GitHub

- Public GitHub stores the shareable version only. Account-specific visual customizations, generated art, prompts and associated account identifiers stay in controlled local backups and the owner-approved private deployment repository. Never upload them to a public repository or public CI.
- The owner authorized a separate private GitHub deployment repository for cloud publication. Verify its exact identity and private visibility before each source push; preserve the fetch-only shared remote and reject all public or unapproved destinations. Do not add collaborators or change visibility.
- Do not merge deployment repository history or copy its complete source over the shared version. Port shared functionality separately and inspect each change.
- Before pushing, run node scripts/check-shared-source.mjs --check. Preserve that check and the local push hook.

## Controlled production releases

- Production may contain deployment-only presentation and permission configuration absent from this public repository. A live private release channel must only be updated from its controlled private checkout.
- Do not publish a shared-only build over a private production channel or remove the release-channel check to bypass a refusal. Merge shared updates into the private branch, retain its private files and access checks, and use its validated release workflow.
- Keep public-repository automatic production builds disabled for a controlled private deployment. Shared CI must not receive private source, assets or access configuration.
- Never run deployment commands from a shared or PR-review checkout, including as a negative probe. A feature branch may predate the deployment guard. Verify refusals with read-only active-version metadata and pure validation or injected no-write test runners; only the controlled private workflow publishes.

## Scheduling rules checklist (planned and live)

Every change to match scheduling (`lib/domain/grouping.ts`, `live-play.ts`, `scheduled-courts.ts`, `points-plan.ts`, `points-auto-start.ts`, `planned-gap.ts`, `planned-replan.ts`, `fixed-partners.ts`, `match-balance.ts`, `match-history.ts`, `gender-balance.ts` and their callers) must keep every item below. A PR that changes an item must change this list, the linked document and a test in the same PR, and say so in its description. Details: [Scheduling modes](docs/SCHEDULING_MODES.md), [Match grouping](docs/MATCH_GROUPING.md), [Live court rotation](docs/LIVE_PLAY.md), [Gender-aware pairing](docs/GENDER_BALANCE.md), [Per-court progress](docs/COURT_ROUND_PROGRESS.md), [No-shows](docs/NO_SHOW.md), [Late and arrival](docs/POINTS_ATTENDANCE.md).

### A. Hard rules for both modes (never broken, whatever the fairness or balance gain)

1. Nobody plays on two courts or in two games at once, in this activity or another one. Courts with the same venue and name are one physical court.
2. Only available players are scheduled: an enabled player with a confirmed signup, inside their signup time and the court's booking time and venue, not reported late or absent until arrival is confirmed, not stopped, and (live) not on a voluntary break.
3. A court is used only inside its booking. After the scheduled end, only overtime continues, from the final attendance and court phase, and only on an explicit action (adding a round, publishing, a score, Start grouping). Background maintenance never starts a game after the end or in an activity closed early.
4. Fixed partners are never split by the scheduler. Only an organiser's single-player late substitution may break a pair, for that one game.
5. The scheduler never changes a recorded score, a started game, or a completed, forfeited or no-show result. Score corrections and identical retries never start another game.
6. Every change is one atomic transaction. Lineup edits carry the displayed lineup and a stale one gets 409. Concurrent reads and scores commit one result, and a failure rolls everything back.
7. Drafts are never published by the clock, an explicit pause is respected, and every new clock-driven change is registered in the live conditional-read boundaries (`lib/club-read-cache.ts`).
8. Cancelled games and no-show forfeits never count as played for the other players.

### B. Who plays, then how they are split (both modes)

1. Who plays is decided first, by turn fairness: games owed against each player's share while present, then the longest wait. Strength, gender and variety never decide who plays; they may only swap between players with equal or nearly equal turns (planned: same games owed and rest, waits at most one round apart; live: waits at most one game apart and not owed fewer).
2. The players chosen are then split into teams and courts by `compareBalance`, in this order: gender mismatches first ([Gender-aware pairing](docs/GENDER_BALANCE.md)), then the worst rating gap above the 40-point tolerance including the costs of an exact rematch, a repeated foursome, a block of three or more from one earlier game, a repeated partner and (planned, several courts) a court that must wait for another court; then the total gap and partner and opponent variety.
3. Gender and repetition costs never move a player onto or off the court. When every split has a mismatch, the best balanced split is still scheduled.
4. A player who played the last three rounds rests whenever someone else can take the place; a court is never left short only for this.

### C. Planned schedule (the default and recommended mode)

1. It is the recommended mode because it splits everybody of a round at once and keeps the sides even (mean rating gap 20-37 against 106-140 live in simulation). The recommendation is shown only to people who can switch.
2. An activity that never had a round is planned, published and started by the clock at its start; a failed attempt is retried only after signups, presence or courts change. A schedule cancelled on purpose is never recreated.
3. Each court continues on its own: a score starts the earliest unfinished published game on that physical court in the same transaction. A game never starts before its attendance phase, even if earlier courts finished fast.
4. At an attendance or court phase boundary, unstarted games of the phase that ended are cancelled without penalty (only when a confirmed next phase exists), and every later unstarted round is planned again from the games actually played (`pointsReplan`). Hand-swapped rounds, started or scored rounds, drafts and overtime rounds keep their lineups; if one round cannot be planned, nothing changes.
5. When the current phase's games are done and the next phase has not begun, free courts get extra games from the present players if at least five minutes remain (`pointsGapFill`).
6. Lineups stay editable by organisers until a score is recorded. The clock never overwrites a hand edit.
7. After the activity ends, published games that never started and have no score are deleted; overtime and live rounds are not.

### D. Live scheduling

1. After each game all players leave the court; winners do not stay on, and there is no win limit or automatic break.
2. The next players come from a queue: waiting players before the court's just-finished players, then the longest wait since the previous game (since arrival for someone who has not played), then games owed, then signup order.
3. Balance or variety swaps must keep the queue: nobody left on the bench may have waited more than one game longer than a waiting player chosen, and a bench player passed over (`livePassed`) is not passed over again before they play.
4. A game may not take three or more players from one earlier game while others can play. Fixed pairs move as whole teams, and two teams that just played each other are not paired again when another team can come in.
5. A finished court waits for Start grouping (`liveNext`). With fewer than four available players (two complete teams for fixed partners) the court waits; the same four may keep playing when nobody else is available.

### E. Known limits (do not report them as bugs without a fix that keeps A-D)

1. Live play splits only the four players whose turn it is, so its sides are far less even than planned rounds.
2. Planned rounds leave courts idle when only about one player per court rests, because each next game needs players from courts still playing; live play fills courts faster there.
3. With exactly four players per court plus one in live play, a block of three from one game cannot always be avoided.
4. Fixed partners with an odd number of teams or an absent partner leave some players with fewer games; this comes from the teams, not the scheduler.
