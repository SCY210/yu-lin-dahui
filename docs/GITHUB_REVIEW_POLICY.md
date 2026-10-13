# GitHub review policy

The owner explicitly authorized `zehang0228` on 2026-10-13 to merge pull requests
into `main` without SCY210 approval. This is a named, PR-only exception. The
collaborator still has Write access, not repository Admin access. Other
collaborators retain the existing review requirements.

The active [main-review-policy ruleset](https://github.com/SCY210/yu-lin-dahui/rules/24955954)
targets only `refs/heads/main`. Its reproducible API payload is
[main-review-ruleset.json](../.github/main-review-ruleset.json).

| Account | GitHub user ID | Ruleset bypass |
| --- | --- | --- |
| SCY210 | 111634609 | Always, preserving the owner's existing exemption |
| zehang0228 | 146497504 | Only when merging through a pull request |
| Other collaborators | Not allowlisted | No bypass |

The review rule requires one approval, Code Owners review, and dismissal of stale
approvals after new commits. `.github/CODEOWNERS` still assigns SCY210. The
existing classic protection retains its other settings, including disabled force
pushes and branch deletion. Only its duplicate review requirement was removed,
after the new ruleset was active and returned by the effective branch-rules API.

Classic branch-protection bypass lists support organization-owned repositories;
this personal repository therefore uses a ruleset with explicit User actors.
See GitHub's [classic protection guidance](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule)
and [ruleset API](https://docs.github.com/en/rest/repos/rules).

Verification read back the active ruleset, exact actor IDs and modes, main-only
conditions, effective review rule, and unchanged non-review classic settings.
The collaborator's permission endpoint still reports Write with Admin disabled.
No PR was merged and no website code was changed to validate this configuration.

To revoke the exception, remove only the zehang0228 User actor from the live
ruleset, verify the effective rules again, and update the tracked payload and
collaboration instructions. Keep the review rule and the owner's exemption.
