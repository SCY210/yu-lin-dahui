# My page controls

Achievements load with the application and are expanded by default on My. The secondary button collapses or reopens the collection without unmounting it, preserving the selected filter and achievement. Personal badge images load eagerly; other player collections keep lazy image loading.

Account/password and notifications/install controls are grouped into secondary buttons at the bottom of My, after recent matches and group management and before sign-out. Only the selected settings panel mounts; clicking the active button closes it. Existing account, password, push notification, and installation flows retain their behavior and permissions. Panel state resets when the account changes or My is left.

The account/password panel also includes self-service deletion with a 30-day login-cancellation window and immediate voluntary administrator resignation. Both use explicit confirmation and current-password verification for password sessions. The principal owner remains protected. See [account lifecycle](ACCOUNT_LIFECYCLE.md) for cleanup scope and scheduling requirements.
