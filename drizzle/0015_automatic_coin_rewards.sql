CREATE TABLE `treasureRewardClaims` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`event_id` text NOT NULL,
	`payload` text NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `treasure_reward_claims_player` ON `treasureRewardClaims` (`player_id`);--> statement-breakpoint
CREATE INDEX `treasure_reward_claims_event` ON `treasureRewardClaims` (`event_id`);