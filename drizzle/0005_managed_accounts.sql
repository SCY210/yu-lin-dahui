ALTER TABLE `password_credentials` RENAME COLUMN "email" TO "username";--> statement-breakpoint
DROP INDEX `password_credentials_email_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `password_credentials_username_unique` ON `password_credentials` (`username`);