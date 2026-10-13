CREATE TABLE `treasureLedger` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`actor` text NOT NULL,
	`request_id` text NOT NULL,
	`payload` text NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `treasure_ledger_actor_request` ON `treasureLedger` (`actor`,`request_id`);--> statement-breakpoint
CREATE INDEX `treasure_ledger_player` ON `treasureLedger` (`player_id`);--> statement-breakpoint
CREATE TABLE `treasureOrders` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`product_id` text NOT NULL,
	`account_id` text NOT NULL,
	`request_id` text NOT NULL,
	`payload` text NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `treasureProducts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `treasure_orders_account_request` ON `treasureOrders` (`account_id`,`request_id`);--> statement-breakpoint
CREATE INDEX `treasure_orders_player` ON `treasureOrders` (`player_id`);--> statement-breakpoint
CREATE TABLE `treasureProducts` (
	`id` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL
);
