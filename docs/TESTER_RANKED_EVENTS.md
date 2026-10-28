# Tester ranked activities

An account with the stored `simulationTester: true` capability may create ranked
singles or doubles activities, enable or disable ranking before play in its own
activities, and use the existing ranked scheduling controls for those activities.
Live scheduling, preplanning and round-by-round scheduling use the same permission
rule. The activity clock may also select its tester creator as the scheduling actor.

Testers keep the `member` role. This capability does not authorize managing another
creator's activities, changing accounts or club settings, granting points or rating,
reading administrator-only data, or granting tester access. Owner and administrator
permissions remain unchanged. Practice activities and already-started or historical
ranking changes retain their existing restrictions.

The server uses the authenticated stored account and stored activity creator ID.
Request fields such as `simulationTester`, `role`, `isOwner` or a forged activity ID
do not grant permission. Revoking tester access removes ranked scheduling authority
immediately; already-recorded activities and results are preserved. No migration or
production account change is required, and legacy ranking classification is unchanged.
