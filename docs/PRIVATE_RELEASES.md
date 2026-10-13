# Controlled private releases

Shared application code and deployment-only presentation are maintained in
separate Git histories. The public repository must never receive private source,
assets, generation prompts or identity allowlists. Public CI does not fetch that
material or receive credentials for it.

The controlled local production checkout keeps a private branch above reviewed
shared commits. Its shared remote is fetch-only: the push URL is disabled and a
local hook rejects public and unapproved destination pushes. An owner-approved
private source repository is a separate destination whose private visibility must
be verified before each synchronization. Updating means fetching and merging shared `main`
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

## Automatic cloud publication after merges

The public `private-release.yml` workflow runs after a push to `main`, including a
merged PR. It has no repository permissions, does not check out application code,
and receives only `CLOUDFLARE_PRIVATE_DEPLOY_HOOK`, an encrypted Actions secret.
Set the repository variable `PRIVATE_RELEASE_ENABLED=true` only after that secret
and the private build connection have been verified. Without this explicit switch
the job stays disabled. Never put the hook URL in source, logs or job artifacts.

The hook requests a build from an owner-approved **private** source repository.
Public CI receives no private repository credential, source archive, production
API token or account allowlist. Cloudflare checks out that private source,
prepares `.sites-runtime/cloudflare-private`, and invokes its existing
`npm run release:private` command. The release fetches and merges current shared
`main`, verifies protected private files and access integrations, installs locked
dependencies when needed, tests, builds, applies required migrations and publishes.
Conflicts, integrity failures, stale main, failed checks or unavailable metadata
stop publication. Never resolve conflicts by replacing the private tree.

Keep public-repository production builds disabled or disconnected. Only the
private source build may use the production deployment token. Disable previews
for that build and never execute a shared/review checkout deployment command.
The private destination must remain private and owner-controlled; it is not a
place to grant ordinary public-repository collaborators additional access.

A successful hook request means a build was queued, not that deployment succeeded.
The private release must confirm the active Worker version receives production
traffic, carries `YULIN_RELEASE_CHANNEL=private`, identifies the exact shared SHA,
and passes anonymous availability/authentication checks. Preserve its receipt
with shared SHA, private source SHA, Worker version and time. Keep failed builds
visible for diagnosis and rerun after correction; do not claim they are live.

Cloud publication runs without the owner's computer. Pause the older local
15-minute publisher only after a real cloud deployment has been verified, avoiding
competing publishers. The separate daytime PR notification task is unchanged.
To stop new automatic requests, set `PRIVATE_RELEASE_ENABLED=false`; this does
not change the live website. Rotate a disclosed hook and update the encrypted
secret. Cloudflare Builds and GitHub usage remain subject to their free quotas;
this workflow does not upgrade plans or enable paid overages.
