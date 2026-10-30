-- Live referee scores of competition matches (docs/LIVE_SCORING.md): one row per match, written once per tap.
CREATE TABLE `live_scores` (
	`match_id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`payload` text NOT NULL,
	`version` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `live_scores_event` ON `live_scores` (`event_id`);
