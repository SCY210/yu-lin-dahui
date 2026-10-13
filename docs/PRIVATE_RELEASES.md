# Controlled private releases

Shared application code and deployment-only presentation are maintained in
separate Git histories. The public repository must never receive private source,
assets, generation prompts or identity allowlists. Public CI does not fetch that
material or receive credentials for it.

The controlled local production checkout keeps a private branch above reviewed
shared commits. Its shared remote is fetch-only: the push URL is disabled and a
local hook rejects pushes. Updating means fetching and merging shared `main`
into the private branch, not replacing the private tree. Conflicts stop the update.
The release workflow verifies protected-file hashes and required integration
points before and after updating, tests the application and access controls,
builds the standalone target, then applies pending D1 migrations before publishing.
Changed dependency inputs require installation and verification before release.

Production builds carry `YULIN_RELEASE_CHANNEL=private` in both source and built
configuration. The shared deploy command reads the most recent deployment by
timestamp, inspects every version receiving traffic, and refuses to replace a
private version with a build lacking that channel. Metadata errors stop publication;
they are never treated as an unrestricted deployment. The channel is a deployment
safeguard, not a secret or a replacement for account permissions.

Do not invoke a deployment command from a shared or PR-review checkout to test
that it refuses publication: a feature branch can predate the guard even when
its PR targets a guarded main branch. Use read-only active-version metadata and
`validateReleaseChannel`, or the injected no-write runners in the test suite.
Only the controlled private workflow is allowed to publish to production.

Keep automatic Cloudflare builds from the public repository disabled. This
provider setting is essential because a bare Wrangler command would bypass the
project's deploy wrapper. Do not re-enable it against a public-only checkout.
Future common functionality still goes to public GitHub, then enters production
through the controlled merge and private release workflow.

Private source and its local Git history need a separate controlled backup.
Application D1 and R2 recovery remain separate from source backup. Existing public
Git history is not rewritten by this workflow, and earlier copies cannot be
recalled. Preserve the shared-source privacy check and existing account-level
permission checks in every release.

## Automatic publication after merges

The desktop follow-up checks shared main every 15 minutes. It only publishes
already-merged shared commits; it does not approve or merge pull requests.
The separate daytime PR notification task retains its existing schedule.

A release runs only from the controlled private checkout, through its existing
private release command. Fetch shared main, merge it into the private branch,
verify protected files and permission integration, run the required tests and
build, then publish. Never enable public-repository production builds or copy
private material into shared CI. Conflicts, integrity failures, dirty local work,
failed checks and authentication failures stop publication. An active private
release is allowed to finish before another attempt starts.

Keep a local receipt containing the successfully published shared commit, private
source commit and verified active private Worker version. Only update the receipt
after the private release command succeeds and read-only deployment metadata
confirms the version and channel. A merge alone is not publication. If main has
not changed since that receipt, skip the release. Preserve pending failures so
subsequent checks can resume without re-merging or repeating notifications.

This is local scheduled publication, not an immediate cloud webhook. The computer
and desktop application must be running, the private checkout must remain
available, and GitHub/Cloudflare authentication must still be valid. Reports stay
in the task conversation; report successful releases and new blockers, while
unchanged checks stay quiet.
