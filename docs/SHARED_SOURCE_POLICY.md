# Shared source and private deployments

This repository contains only the shareable application. Keep exclusive presentation, personal identity configuration, private images and their generation prompts outside GitHub, in the controlled deployment source and a local backup.

Do not merge the deployment repository's full history into this repository. Port common functionality independently and review the resulting diff. Ignoring a file does not remove earlier Git history or prevent an already tracked file from being committed.

Before pushing, run `node scripts/check-shared-source.mjs --check`. Enable the checked-in hook with `git config core.hooksPath .githooks`. CI runs the same check with read-only repository access on pushes and pull requests. Do not disable this safeguard to publish custom deployment material.

The check validates current tracked filenames and content. Removing current source does not erase old commits, PR references, clones or downloads. Historical cleanup requires a separate explicit decision and coordinated synchronization.
