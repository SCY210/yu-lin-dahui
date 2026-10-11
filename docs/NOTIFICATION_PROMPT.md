# Notification opt-in on entry

After a signed-in member enters, check this device's actual server-backed push subscription. An enabled subscription suppresses the prompt. Missing or disabled subscriptions show an opt-in dialog after a short delay, once higher-priority score entry and other dialogs are clear. Unknown status or unavailable push configuration skips the offer for this visit.

The enable action is visually primary. The close icon is smaller, with a 44px touch target; the secondary postpone action stays visible and usable.

Only clicking **Enable notifications** requests browser permission, using the same subscription flow as the reminder settings. Permission denial shows browser/device settings instructions; iPhone browser visits explain installing to the home screen. Unsupported browsers do not receive an unusable offer. Subscription failures stay visible in the dialog and allow retrying or dismissing.

Dismissal, including Escape and the close button, postpones the offer for seven days per account on this device. This localStorage entry contains only the prompt expiry; club records and subscription ownership remain server-backed. If storage is unavailable, dismissal still applies to the current visit. Users can always open **Me > Notifications and installation** to enable notifications sooner. Account changes remount the prompt and recheck device ownership; existing logout cleanup is preserved.
