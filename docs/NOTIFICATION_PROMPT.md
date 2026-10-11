# Notification opt-in on entry

After a signed-in member enters, check this device's actual server-backed push subscription. An enabled subscription suppresses the prompt. Missing or disabled subscriptions show an opt-in dialog after a short delay, once higher-priority score entry and other dialogs are clear. Unknown status or unavailable push configuration skips the offer for this visit.

The enable action is visually primary. The close icon is smaller, with a 44px touch target; the secondary dismiss action stays visible and usable.

Only clicking **Enable notifications** requests browser permission, using the same subscription flow as the reminder settings. Permission denial shows browser/device settings instructions; iPhone browser visits explain installing to the home screen. Unsupported browsers do not receive an unusable offer. Subscription failures stay visible in the dialog and allow retrying or dismissing.

Dismissal, including Escape and the close button, applies only to the current visit. A fresh page load, return to a visible app/tab, or restored page rechecks this device's subscription and offers notifications again if still disabled. Ordinary data polling, rerenders, and navigation within the current visible session do not reopen a dismissed offer. Returns during an in-flight enable operation are ignored so a system permission prompt cannot restart subscription setup.

No persistent snooze is stored or read; older seven-day snooze entries no longer affect prompting. Users can always open **Me > Notifications and installation** to enable notifications. Account changes remount the prompt and recheck device ownership; existing logout cleanup is preserved.
