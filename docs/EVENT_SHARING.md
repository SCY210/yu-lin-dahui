# Direct event sharing

The activity signup summary has a **分享活动** (Share event) button in place of the old roster-copy action. It opens the device's native share sheet through the [Web Share API](https://www.w3.org/TR/web-share/) when supported and permitted by the browser. Available apps depend on the device. Sharing requires a user click; no recipient is selected and no message is sent automatically.

When native sharing is unavailable, disallowed (including some embedded previews), or fails, a dialog previews the invitation and offers WhatsApp, Telegram, email, and Copy link. The external links open the selected app's composer. Cancelling the native sheet is silent and does not open another dialog. If clipboard access fails, the visible link is selected for manual copying. Dialog focus, Escape, and browser Back use the existing accessible dialog/navigation components.

Invitations contain the club/event title, start and end dates in Europe/Madrid, the venue, current event status, and a canonical link to the event's signup tab. They exclude participant names, registration details, notes, costs, photos, and account data. The link contains only routing parameters and does not grant access. Recipients still need an authenticated member account; normal password login reloads the same event URL. Missing, removed, or inaccessible events follow the existing activity-list fallback. Draft, deleted, and merged-away events cannot be shared.

This feature does not add a public event endpoint or event-specific Open Graph previews. Messaging services can render the supplied invitation text; rich link-card rendering is controlled by the recipient app and is not guaranteed.

Validation: `npm test`, `npm run typecheck`, and `npm run build`. The event-sharing suite covers encoded deep links, safe invitation fields, Madrid dates, draft/deletion restrictions, native sharing, cancellation, failures, and external composer URLs. UI checks should cover the fallback dialog at 390px, keyboard focus, browser Back, denied clipboard access, and direct event navigation. Native mobile share targets require a real device check.
