CREATE TABLE `accountNoticeReceipts` (
 `id` text PRIMARY KEY NOT NULL,
 `account_id` text NOT NULL,
 `notice_version` text NOT NULL,
 `content_hash` text NOT NULL,
 `payload` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_notice_version_hash` ON `accountNoticeReceipts` (`account_id`,`notice_version`,`content_hash`);
--> statement-breakpoint
CREATE TRIGGER `account_notice_no_update` BEFORE UPDATE ON `accountNoticeReceipts` BEGIN SELECT RAISE(ABORT, 'Acknowledgement evidence is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER `account_notice_no_delete` BEFORE DELETE ON `accountNoticeReceipts` BEGIN SELECT RAISE(ABORT, 'Acknowledgement evidence is append-only'); END;
