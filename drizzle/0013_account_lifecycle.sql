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
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_treasureLedger` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`actor` text,
	`request_id` text NOT NULL,
	`payload` text NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_treasureLedger`("id", "player_id", "actor", "request_id", "payload") SELECT "id", "player_id", "actor", "request_id", "payload" FROM `treasureLedger`;--> statement-breakpoint
DROP TABLE `treasureLedger`;--> statement-breakpoint
ALTER TABLE `__new_treasureLedger` RENAME TO `treasureLedger`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `treasure_ledger_actor_request` ON `treasureLedger` (`actor`,`request_id`);--> statement-breakpoint
CREATE INDEX `treasure_ledger_player` ON `treasureLedger` (`player_id`);
--> statement-breakpoint
-- Evidence stays append-only during normal use. The only deletion exception is
-- an expired, server-recorded account-erasure request for the same account.
DROP TRIGGER `account_notice_no_delete`;
--> statement-breakpoint
CREATE TRIGGER `account_notice_no_delete` BEFORE DELETE ON `accountNoticeReceipts`
WHEN NOT EXISTS (
 SELECT 1 FROM `account_deletions`
 WHERE `account_id`=OLD.`account_id`
 AND `delete_after` <= CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)
)
BEGIN SELECT RAISE(ABORT, 'Acknowledgement evidence is append-only'); END;
