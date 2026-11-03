# Shared source and personal checkout state

The repository shares application source, reusable build/runtime helpers, reproducible tests, database migrations, required deployment metadata, and third-party notices. It does not share credentials, local databases, editor/agent profiles, generated screenshots, logs, or one person's historical test runs.

AGENTS.md is a shared collaboration policy and stays tracked; it is written in Chinese. .openai/hosting.json identifies the existing deployment and bindings; it is not a personal instruction file and is necessary to build/deploy this app. Do not ignore all hidden directories or all Markdown/JSON files.

## Reports removed from tracking

These reports describe historical runs in an individual checkout:

- docs/MANAGED_ACCOUNTS_RESULTS.md
- docs/MANAGED_ACCOUNTS_RACE_RESULTS.md
- docs/PLAYER_PROFILE_API_RESULTS.md
- docs/TEST_RESULTS.md

They are ignored and removed from the Git index with git rm --cached. The originals in the working checkout remain; reproducible tests stay in tests/. Preserve reports if you need them as personal evidence. Historical reports are still in Git history; this change is not a secret-purge or history rewrite.

## Preserve another checkout before pulling

A tracked deletion can remove a clean file when another checkout pulls or switches branches. Adding .gitignore or using --cached in this checkout does not prevent that. Run the backup BEFORE applying the cleanup commit.

If the backup script is not yet available on the old branch, fetch the PR branch and extract only that script:

```powershell
git fetch origin feature/request-body-security
$backupScript = Join-Path ([System.IO.Path]::GetTempPath()) ('yu-lin-preserve-' + [guid]::NewGuid().ToString() + '.mjs')
git show origin/feature/request-body-security:scripts/preserve-local-reports.mjs | Set-Content -LiteralPath $backupScript -Encoding utf8
node $backupScript
Remove-Item -LiteralPath $backupScript
```

The temporary extracted script is not an original report. Review/run the script from the repository root, verify its successful output, and only then pull/merge/switch. Alternatively copy the four files manually to a safe local backup outside their tracked paths.

The script copies existing reports to a unique .local/reports/<timestamp-uuid>/docs/ directory and verifies SHA-256 against the source bytes. It never deletes or overwrites originals; repeat runs use different archives. manifest.json records the verified hashes. .local is ignored.

After updating, reports in the archive remain available independently of the tracked deletion. If desired, copy them back to their now-ignored docs paths. Do not use git clean -xfd or any cleanup that deletes ignored backups.

No action in this change directly accesses or deletes another owner's local filesystem. The repository cannot guarantee what a later Git checkout does without the owner's pre-update backup.

## Ignore policy

.gitignore covers dependencies/build outputs; .wrangler/.sites-runtime; .agents/.codex and personal editor state; screenshots, outputs, work, .test-output; .local backups; databases, logs, environment files, and personal instruction overrides.

It does not hide normal source, migrations, shared instructions, licenses, or hosting configuration. Credentials and production exports must never enter Git. If a real secret was committed previously, ignoring/deleting the current file is insufficient: rotate it and handle history separately with the owner's authorization.

Run npm run check:repo to detect prohibited tracked paths, new shared Markdown without Chinese text, listed English documents that gained Chinese text, and broken relative documentation links. This heuristic does not certify translation quality; reviewers still check meaning. Ignored personal reports may keep their original language.

## Existing documentation compatibility

Since November 2026 shared documentation is written in Chinese (until then it was English, with older Chinese notes exempted). New and rewritten documents must contain Chinese text. The English documents that existed then are listed in scripts/english-markdown.json and may stay in English; a listed document that gains Chinese text fails the check, so a rewrite translates the whole document and removes it from the list. Code identifiers, commands, paths and quoted English stay as they are. Tracked-state restrictions and relative-link validation apply to every shared document.
