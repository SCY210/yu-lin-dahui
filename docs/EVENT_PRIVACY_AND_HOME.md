# Deleted activities and the home signup list

Deleted activity workspaces and their linked records are hidden from the normal activity response. Only the original creator and club owner receive the recovery-list entry and may restore it. An unrelated administrator cannot recover an activity by submitting its ID directly. Administrative exports and audit views omit deleted workspaces that the requesting account cannot recover. The stored backup remains intact; completed results continue contributing to historical ranking and player statistics.

Existing inbox reminders for deleted activities are filtered at query time, before the list limit and unread count. This also covers recipients who never registered. Pending device notifications for deleted activities are cancelled, including change notifications. Deletion generates no new title-bearing reminder. Restoring an activity makes retained inbox history available again; notifications already delivered to an operating system cannot be recalled.

The home page shows up to six current or upcoming activity signup cards, ordered by start time. The recent-match section is removed from home; personal match history remains available on the member page. All activities remain accessible from the activity list.

Regression coverage uses fictional domain fixtures and an isolated SQLite notification handler. It checks creator/owner recovery, unrelated administrator denial, export/audit filtering, legacy zero deletion timestamps, inbox pagination and unread counts, pending push cancellation and restoration.
