# Activity Web Push

The activity assistant also supports personal signup, promotion, material schedule changes, published matches, confirmed fees and eligible post-event voting. See [ACTIVITY_REMINDERS.md](ACTIVITY_REMINDERS.md) for recipient rules, inbox, preferences and the explicit timing limitation.

Members opt in separately on each device under **右上角「提醒」→ 提醒偏好与设备设置**. No permission is requested automatically. The explicit button calls the browser permission dialog, registers the existing service worker and uploads the device subscription to the authenticated site. The user can turn it off or send a test to the current device. Each account may register up to five devices.

## Delivery rules

- Notify opted-in members when a newly created activity is open, or an unpublished draft first becomes open. The activity must not be deleted or already over.
- Exclude the actor's own devices. Ordinary roster changes, reopening and restoration do not broadcast another new-signup notification. Material activity changes use targeted reminders.
- Queue the job and its recipient snapshot in the same D1 transaction as the activity save. A failed save cannot create a phantom alert, duplicate requests cannot recreate it, and later subscribers receive only future notices.
- The Worker uses `waitUntil` to send after returning the save response. A durable outbox drains in bounded batches on successful club requests. Claims use an expiring lease to prevent concurrent senders; transient failures retry up to three times on later requests. Large backlogs or outages may therefore be delayed until another club request. Sent jobs use a stable notification tag, without repeated alerts on retry. Delivery through a push provider is not proof the phone displayed it.
- Before sending, recheck current event status and current member eligibility. Expired activities, inactive members and deleted subscriptions are skipped. Provider 404/410 responses remove the expired device. Queue metadata is retained for seven days.

## Browser behavior

Android browsers supporting Web Push can receive reminders while the page is closed. On iPhone/iPad, use a Home Screen web app on iOS/iPadOS 16.4 or later and grant permission after pressing the button. The UI detects an uninstalled iOS web app and directs the user to add it to the Home Screen. OS/browser notification controls still apply. Clicking a notice opens the corresponding activity and preserves normal sign-in requirements.

The service worker shows a visible fallback for malformed/empty payloads, never follows a supplied external URL, and continues to cache only the public offline page. Push payloads and member data are not added to offline caches.

## Ownership and data

Subscriptions are authenticated, origin-checked writes. The server hashes endpoints for row identities, validates P-256 and auth keys, allows only known browser push-provider HTTPS hosts and forbids redirects. No endpoint or encryption key is returned to another member. The API returns only the public VAPID key, configuration readiness and the current device's ownership status. Test requests cannot supply arbitrary recipients or message content and have a separate rate limit.

Endpoint/key data stays in dedicated D1 tables and is excluded from club snapshots and exports. A device cannot be rebound to another account by guessing an endpoint. On account changes the old browser subscription is invalidated; explicit logout also removes the current device's server registration while the owner is still authenticated. Other devices remain subscribed.

Runtime configuration uses Sites environment variables: `PUSH_VAPID_PUBLIC_KEY`, secret `PUSH_VAPID_PRIVATE_KEY`, and `PUSH_VAPID_SUBJECT` (the site URL). Keys are generated once and kept stable; the private key is never written to source, hosting manifests or documentation. Encryption uses pinned `@block65/webcrypto-web-push` 2.0.0 (`aes128gcm`, RFC 8291; VAPID, RFC 8292), with a 24-hour provider TTL and a bounded request timeout.

## Verification

Tests cover publication boundaries, provider validation, safe notification clicks, visible fallback, authentication/ownership/CSRF, five-device limits, test rate limits, an actual encrypted payload independently decrypted with the receiver's private key, VAPID signature and audience, real SQLite transaction rollback, recipient snapshots, concurrent claims, reopening deduplication, retries, inactive members, unsubscribe cascading and expired-device cleanup. Tests use generated fixture keys and an intercepted local fetch; they never send to a real device or push vendor.

Sources: [Apple Home Screen Web Push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), [MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API), [WebCrypto Web Push library](https://github.com/block65/webcrypto-web-push/blob/master/packages/web-push/README.md).
