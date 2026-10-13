# Optional device notifications

System notifications are optional on both the legacy Sites app and the standalone Worker. The prompt always offers **Not now** and the standard close control; Escape, backdrop and phone Back may dismiss it. Denied browser permission, iPhone installation requirements, missing configuration, subscription failures and slow enrollment must never trap a user in the prompt.

Dismissal does not request permission, create a subscription, claim success or persist a snooze. An ordinary rerender stays quiet; a fresh visit or foreground return can offer the optional prompt again. Notification settings remain available on the My page, and in-app reminders do not require a system subscription. Existing account/activity notice requirements are separate and unchanged.

Data synchronization between these deployments is a distinct operator action. Business rows, credentials and image bytes require separate verification. Keep destination-only credentials, sessions and device subscriptions; source-origin push subscriptions and pending delivery jobs are not portable across origins or VAPID keys. The read-only migration snapshot includes account activity-notice receipts, with the complete current schema, so existing confirmations are not silently lost or recreated.

Before syncing a populated destination, save a complete SQL export and recovery point, compare a source snapshot with the previous migration baseline and destination state, and rehearse the exact merge in isolation. Do not overwrite concurrent changes, replace the entire database or treat a club JSON export as a complete backup. Remove temporary export credentials after verification.
