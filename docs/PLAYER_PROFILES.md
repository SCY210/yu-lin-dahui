# Player profiles and racket photos

app/player-profile.tsx exports PlayerProfile({p, stats, ctx}) and uses scoped pp-* / racket-* styles in app/player-profile.css. The profile shows avatar, name, tier/form, experience, handedness, preferences, self-assessed level/style, racket/strings/tension range, equipment notes, match count, and streaks. Missing details remain visibly unfilled; the app does not invent brands or personal facts.

## Profile fields and permissions

Player.profile retains years, hand, preference, style, equipment, and level. Optional racket and strings fields accept at most 120 characters. tensionMin and tensionMax are numbers from 1 to 80, including decimals.

Both range endpoints must be present, the maximum cannot be below the minimum, and two null values clear the range. A legacy single value can display as an equal-endpoint range. Recognizable legacy ranges remain readable; ambiguous historical text stays intact until explicitly replaced. A formatted tension string preserves old-client compatibility.

Grip/shoes are no longer accepted or displayed. Historical stored fields remain but are omitted from group profile projections.

Server permissions are authoritative. The member self-service detailed-profile operation permits their own account player; administrators may edit other unprotected players. Basic name changes and photo flows have their own ownership rules. A visible UI affordance is not proof of API permission.

Updates merge into existing profiles: omitted optional fields remain, explicit empty strings clear strings, and explicit null pairs clear tension ranges. No database-table migration is required.

## Racket gallery

app/racket-gallery.tsx exports RacketGallery({ctx, playerId}). It selects kind=racket photos containing the player ID and sorts newest first. Authenticated /api/photos/{id} serves image bytes. Empty galleries do not invent photos or equipment.

Multipart uploads include file, kind, playerId, caption, revision, a UUID requestId, and the explicit image-rights confirmation. Racket images need no activity/match association. JPEG, PNG, and WebP are supported, at most 5 MiB, with captions up to 300 characters. The server validates content, dimensions, permissions, and revision. R2 stores bytes; D1 stores relationships.

A local object URL previews the file and is revoked on replacement/unmount. Retrying reuses requestId; changing file/caption resets it. Submission disables duplicates. Failures retain inputs; a 409 refreshes data before retry. Success clears fields and refreshes; a failed refresh does not falsely report that the upload itself failed.

Avatar tools reuse PhotoGallery. Photo deletion uses the shared authorized deletion control; there is no automatic third-party facial recognition.

## Verification

tests/player-profile-api.mjs uses fictional local accounts and image fixtures. Check permissions, field preservation/clearing, real byte round-trips, idempotency, stale-revision 409, image rejection, avatar/activity compatibility, and 390px layout.

The framework body allowance is 6 MiB while the file limit stays 5 MiB, leaving multipart overhead. See [Next.js bodySizeLimit](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions#bodysizelimit); the installed Vinext implementation and the actual build must also be checked.

Historical per-checkout API results remain local and ignored. No production profile, credential, or image should be used as a test fixture.
