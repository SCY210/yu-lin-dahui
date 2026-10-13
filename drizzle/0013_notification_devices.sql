CREATE TABLE `notification_devices` (
 `id` text PRIMARY KEY NOT NULL,
 `account_id` text NOT NULL REFERENCES `accounts` (`id`) ON DELETE CASCADE,
 `subscription_id` text NOT NULL,
 `active` integer NOT NULL DEFAULT 1,
 `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_devices_account_subscription` ON `notification_devices` (`account_id`,`subscription_id`);
