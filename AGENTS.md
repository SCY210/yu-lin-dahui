# Project collaboration requirements

## Significant updates must be synchronized to GitHub

- The canonical repository is [SCY210/yu-lin-dahui](https://github.com/SCY210/yu-lin-dahui).
- Before finishing any significant update to core functionality, page flows, permissions, security, data structures, architecture, or deployment configuration, synchronize the relevant code, documentation, and necessary configuration to GitHub. Local changes or an updated deployed website alone are insufficient.
- Validate the update before synchronization. After synchronization, verify that the remote commit contains the changes and provide the commit or PR URL and status. If authentication, permissions, or networking prevent synchronization, explain the specific cause and clearly state that GitHub has not been updated.

## Commits and review

- The owner and Codex/assistants performing authorized work through the owner's SCY210 account may update main directly, without a separate PR or additional approval. Significant updates still require validation and GitHub synchronization.
- Other invited collaborators must submit changes through a PR approved by SCY210 before merging into main. New commits require renewed review; collaborators must not push directly to main.
- GitHub enforces protection by account and permissions. Preserve the owner's administrator exemption. Do not grant administrator exemptions to other collaborators or disable their PR and Code Owners review requirements.
- PR submission permissions remain restricted to invited collaborators. The user must explicitly identify any new collaborator.

## Shared documentation and local state

- Write new or rewritten shared Markdown documentation in English. Existing untranslated notes listed in scripts/legacy-markdown.json may retain their language; preserve their up-to-date behavior descriptions when resolving conflicts. This does not require translating the application UI, user data, test fixtures, or third-party license notices.
- Keep source code, reproducible tests, migrations, licenses, and required hosting configuration tracked.
- Keep personal agent/editor state, credentials, local databases, generated outputs, and per-checkout reports ignored.
- To stop tracking local files, preserve their contents and use git rm --cached. Never delete another contributor's local working files.
- Git may remove formerly tracked files when another checkout pulls a deletion. Document a backup procedure before merging such a change; ignoring a path alone does not preserve it during checkout.
- Legal notices must describe actual processing and real operator details. Do not invent identities, legal bases, consent, retention rules, or compliance guarantees.

## Privately customized material stays outside GitHub

- GitHub stores the shareable version only. Account-specific visual customizations, generated art, prompts and associated account identifiers stay in controlled local backups and the Sites deployment repository. Do not upload them to GitHub.
- Do not merge deployment repository history or copy its complete source over the shared version. Port shared functionality separately and inspect each change.
- Before pushing, run node scripts/check-shared-source.mjs --check. Preserve that check and the local push hook.
