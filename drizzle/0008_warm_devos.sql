CREATE TABLE `push_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`subscription_id` text NOT NULL,
	`state` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_at` integer NOT NULL,
	`lease_until` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `push_jobs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subscription_id`) REFERENCES `push_subscriptions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `push_deliveries_pending` ON `push_deliveries` (`state`,`next_at`);--> statement-breakpoint
CREATE TABLE `push_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`request_key` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `push_jobs_created` ON `push_jobs` (`created_at`);--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `push_subscriptions_account` ON `push_subscriptions` (`account_id`);