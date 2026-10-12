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
