# Installing the badminton web app

The existing website is a progressive web app (PWA). Installation adds a home-screen icon and a standalone window; it does not require an APK, App Store listing, or a new account. Browser menu wording varies.

## Android

1. Open the website in Chrome and use the install entry on the login or personal page.
2. Accept the browser's installation prompt when available.
3. Otherwise choose Install app or Add to Home screen from Chrome's menu.
4. Open the new icon and use the existing account.

## iPhone

1. Open the website in Safari and use Share.
2. Choose Add to Home Screen.
3. Enable Open as Web App if offered, then add it.
4. Open the icon. Safari and the installed app may have independent login state, so sign-in may be needed again.

For an embedded browser, first open the page in the system browser. iOS uses manual instructions rather than Chrome's install-prompt API.

## Connectivity, privacy, and updates

Registration, voting, scores, fees, and uploads require connectivity. Offline writes are not queued and private club data is not shown offline. Retry fetches fresh server data. Website updates do not require a separate installation package.

The manifest has stable ID /, same-origin scope and start URL, 192/512px icons, a 512px maskable icon, and a 180px Apple icon derived from the existing badminton mark.

The service worker caches only the public offline page. It does not cache the home page, APIs, photos, credentials, or writes. Existing server authentication and logout controls remain authoritative.

tests/pwa.test.ts checks manifests, icon dimensions, lifecycle/network behavior, sensitive-request exclusions, and update headers. Real Android/iPhone installation requires separate device validation; support is not promised for every embedded browser.

Official instructions: [Apple web apps](https://support.apple.com/en-lamr/guide/iphone/iphea86e5236/ios) and [Chrome web apps](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=en-GB).
