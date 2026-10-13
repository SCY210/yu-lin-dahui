# Required notification setup on supported devices

After a signed-in member enters, check this device's server-backed push subscription. An enabled subscription suppresses the prompt. When a supported, configured device has no enabled subscription, show the notification setup dialog after higher-priority score/account dialogs clear.

The application dialog has no general close icon or dismissal button. Overlay interaction, Escape and controlled close requests do not close it. Dialog history remains blocked throughout setup, including idle/error states, so the mobile Back button cannot dismiss it. Foreground and restored-page checks retain an open prompt while checking the subscription; they never briefly hide it or add a new dismissal opportunity.

Only the explicit enable click requests browser notification permission. The dialog normally closes after the shared subscription flow saves successfully, or after a server-backed status check confirms this device is already enabled. Native browser/OS permission controls and closing the entire browser remain outside application control.

Denied permission keeps the dialog open with OS/browser settings instructions and a recheck-and-enable action. iPhone browser visits explain adding the site to the home screen; rechecking cannot pretend installation or permission has succeeded. After permission is granted in settings, an explicit recheck can complete the server subscription. Failed subscription/configuration checks keep errors visible and offer a working retry action.

If the browser push provider fails (including Chromium's `Registration failed -
push service error` or an aborted push subscription), show a localized explanation
that login still works and a temporary continue action. This is the only dismissal
exception. Continuing does not save a subscription, emit an enabled event, show a
success toast or persist a snooze. Ordinary rerenders keep the prompt closed for
that visit; a fresh visit/background return offers setup again. A retry clears the
exception while in progress. Permission denial, invalid keys, account ownership
changes and server synchronization failures do not grant this exception.

On Android Chrome, updating Chrome and Google Play services or switching networks
can help diagnose a provider failure. A valid site public key does not prove that
the device can reach its push provider. Keep device/network diagnosis distinct
from a verified website recovery fix; never report that push is enabled merely
because the member continued into the app.

Unsupported devices, unknown subscription status and unavailable initial server configuration skip the prompt rather than permanently blocking a device that cannot enable push. Existing logout/account ownership checks and subscription isolation remain unchanged. Old snooze values have no effect.

Verification covers all dismissal handlers, mobile-history blocking, foreground and page restore, explicit enable calls, denial and installation recovery, provider-only temporary continuation, fresh-visit retry, external verified enabling and initial dialog priority. Shared push-flow tests verify that permission is requested synchronously from the click and that failures never report a successful subscription.

## Detailed iPhone steps

The prompt lists what the notifications cover. On an iPhone that has not installed the site, it shows four numbered steps: check iOS 16.4 or later, open the site in Safari (leaving WeChat first) and tap Share, choose Add to Home Screen, then open the home-screen icon and allow notifications. When an iPhone has blocked notifications, it shows the path in Settings > Notifications. The same steps appear in the reminder center (`app/ios-push-steps.tsx`).

The iPhone guide covers both a visible Share button and the page-menu Share action, plus Edit Actions when Add to Home Screen is missing, following [Apple's installation guide](https://support.apple.com/guide/iphone/iphea86e5236/ios). The minimum Web Push requirement remains iOS/iPadOS 16.4 with a Home Screen web app, as documented by [WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).
