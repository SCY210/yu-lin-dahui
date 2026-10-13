# Notification enrollment points

Policy `2026-10-13-v1` awards 10 doubles season points once per account after explicit enrollment and push-service acceptance. A member with an existing subscription can claim from notification settings after reading the same rules. Legacy clients and silent status checks do not enroll an account in this policy.

After the award, explicitly disabling any registered device in the site's settings deducts 30 doubles season points once. Re-enabling never grants another award. The net adjustment after both actions is -20, and the balance may be negative. Points belong to the month of each action and feed the corresponding quarterly and annual doubles boards. They do not change singles points, match counts, wins, cultivation or grouping strength.

The notification prompt and settings disclose both adjustments before enrollment; disabling requires confirmation. Notifications remain optional. Device-specific logout, provider expiry, delivery errors and subscription cleanup do not deduct points. Browser/system revocation cannot reliably be distinguished from automatic subscription loss and is not penalized. Disabling notification categories does not remove a device subscription.

Server authentication determines the account. Device writes and immutable audit deltas share an optimistic club-revision transaction, with retry on conflicts. Device ownership is checked again within the penalty transaction. Enrollment validates subscription keys and requires successful push-service acceptance before the first reward; this is not proof that the operating system displayed the notification. Provider failure grants no points.

The penalty is a product rule requested by the owner, not a legal compliance guarantee. Where personal-data processing relies on consent, a penalty for withdrawing consent can undermine freely given consent; disclosure alone does not resolve that issue.

Tests use synthetic members, in-memory SQLite and a mocked push provider. Never test incentive accounting against production members.
