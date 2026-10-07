# Theme-aware identity

The header, login screen, browser favicon and Apple touch icon share a modern shuttlecock mark. Classic uses violet, wuxia uses charcoal plum and champagne gold, and the restricted aquarium theme uses pink. New visitors default to classic; existing stored theme choices and aquarium permissions remain in place.

Editable SVG masters are in `public/brand/`. Run `node scripts/build-brand-icons.mjs` to generate opaque 192/512 PNGs, 180px Apple icons and safe-zone maskable icons. Legacy icon URLs, Safari's root fallback and notification icons are refreshed too.

The manifest remains at `/manifest.webmanifest`, with unchanged ID, start URL and scope `/`. It is now an uncached route that selects a validated public palette from the non-sensitive `yulin_icon_theme` device cookie. The preference contains no account, authorization or club records. Invalid values fall back to classic. Browser icon links update when the theme changes; the same manifest URL is reinserted to allow a fresh install to read the palette.

An already installed home-screen icon is controlled by the browser/OS; live replacement cannot be promised. Android can apply manifest updates later, desktop Chrome does not update installed icons, and Apple uses touch icons when adding a web clip. The install guide explains re-adding an old installation after choosing a theme. Removing the local installation does not delete server-held club data.

References: https://web.dev/articles/manifest-updates and https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html
