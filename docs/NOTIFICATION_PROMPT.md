# Required notification setup on supported devices

After a signed-in member enters, check this device's server-backed push subscription. An enabled subscription suppresses the prompt. When a supported, configured device has no enabled subscription, show the notification setup dialog after higher-priority score/account dialogs clear.

The application dialog has no close icon or dismissal button. Overlay interaction, Escape and controlled close requests do not close it. Dialog history remains blocked throughout setup, including idle/error states, so the mobile Back button cannot dismiss it. Foreground and restored-page checks retain an open prompt while checking the subscription; they never briefly hide it or add a new dismissal opportunity.

Only the explicit enable click requests browser notification permission. The dialog closes after the shared subscription flow saves successfully, or after a server-backed status check confirms this device is already enabled. Native browser/OS permission controls and closing the entire browser remain outside application control.

Denied permission keeps the dialog open with OS/browser settings instructions and a recheck-and-enable action. iPhone browser visits explain adding the site to the home screen; rechecking cannot pretend installation or permission has succeeded. After permission is granted in settings, an explicit recheck can complete the server subscription. Failed subscription/configuration checks keep errors visible and offer a working retry action.

Unsupported devices, unknown subscription status and unavailable initial server configuration skip the prompt rather than permanently blocking a device that cannot enable push. Existing logout/account ownership checks and subscription isolation remain unchanged. Old snooze values have no effect.

Verification covers all dismissal handlers, mobile-history blocking, foreground and page restore, explicit enable calls, denial and installation recovery, temporary configuration/provider failures, external verified enabling and initial dialog priority. Shared push-flow tests verify that permission is requested synchronously from the click and that failures never report a successful subscription.
