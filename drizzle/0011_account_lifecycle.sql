CREATE TABLE `account_deletions` (
	`account_id` text PRIMARY KEY NOT NULL,
	`requested_at` integer NOT NULL,
	`delete_after` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_deletions_due` ON `account_deletions` (`delete_after`);--> statement-breakpoint
CREATE TABLE `account_erasure_objects` (
	`storage_key` text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE `erased_identities` (
	`id` text PRIMARY KEY NOT NULL
);
