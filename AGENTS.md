# Project collaboration requirements

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
