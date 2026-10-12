# One canonical application

The owner selected automatic navigation from the legacy Sites address to the standalone Worker instead of maintaining two independent frontends and databases. Configure `CLUB_REDIRECT_ORIGIN` **only on the legacy deployment**, with the verified HTTPS canonical origin. Do not set it on the destination Worker.

Browser GET/HEAD navigation receives a non-cached 307 redirect preserving its path and query string. Activity, player and ranking deep links therefore retain their context. Previously open legacy tabs must refresh. Cached legacy API requests and all non-GET/HEAD requests receive 410 without executing local handlers or forwarding cookies/password bodies across origins. Static shell and service-worker update resources stay available. Invalid or same-origin configuration returns 503, never a writable local fallback.

Data is not periodically copied in this mode: all normal visits use the canonical application's database and private image storage. The old database remains an untouched recovery source. Before enabling the redirect, back up the canonical database. Once the legacy write guard is active, reconcile any final old-origin changes against the last verified synchronization baseline, rehearse and verify the merge, and disable the expiring read-only migration exporter again. Its endpoint retains the separate token guard while reconciliation is running.

Verify deep-link navigation, stopped legacy API writes, canonical authentication and data, and 404 for migration exports before completion. Keep existing accounts and passwords. An installed old-origin PWA may open the canonical origin in a browser; install from the canonical origin for the new app scope.

Rollback requires clearing the legacy runtime setting and republishing. Do not resume independent legacy writes without first accounting for newer canonical data. Redirects are intentionally not permanently cached so application rollback remains controllable.
