-- Transactional change feed for server-side incremental snapshots. Contains private payloads; never expose directly.
CREATE TABLE club_changes (seq INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, table_name TEXT NOT NULL, row_id TEXT NOT NULL, payload TEXT);
--> statement-breakpoint
CREATE TRIGGER club_sync_settings_insert AFTER INSERT ON settings WHEN NEW.id='club' BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('settings',NEW.id,NEW.payload); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_settings_update AFTER UPDATE OF payload ON settings WHEN NEW.id='club' AND OLD.payload IS NOT NEW.payload BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('settings',NEW.id,NEW.payload); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_settings_delete AFTER DELETE ON settings WHEN OLD.id='club' BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('settings',OLD.id,NULL); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_accounts_insert AFTER INSERT ON accounts WHEN 1 BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('accounts',NEW.id,NEW.payload); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_accounts_update AFTER UPDATE OF payload ON accounts WHEN 1 AND OLD.payload IS NOT NEW.payload BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('accounts',NEW.id,NEW.payload); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_accounts_delete AFTER DELETE ON accounts WHEN 1 BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('accounts',OLD.id,NULL); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_players_insert AFTER INSERT ON players WHEN 1 BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('players',NEW.id,NEW.payload); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_players_update AFTER UPDATE OF payload ON players WHEN 1 AND OLD.payload IS NOT NEW.payload BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('players',NEW.id,NEW.payload); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_players_delete AFTER DELETE ON players WHEN 1 BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('players',OLD.id,NULL); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_events_insert AFTER INSERT ON events WHEN 1 BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('events',NEW.id,NEW.payload); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_events_update AFTER UPDATE OF payload ON events WHEN 1 AND OLD.payload IS NOT NEW.payload BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('events',NEW.id,NEW.payload); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_events_delete AFTER DELETE ON events WHEN 1 BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('events',OLD.id,NULL); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_bookings_insert AFTER INSERT ON bookings WHEN 1 BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('bookings',NEW.id,NEW.payload); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_bookings_update AFTER UPDATE OF payload ON bookings WHEN 1 AND OLD.payload IS NOT NEW.payload BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('bookings',NEW.id,NEW.payload); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_bookings_delete AFTER DELETE ON bookings WHEN 1 BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('bookings',OLD.id,NULL); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_registrations_insert AFTER INSERT ON registrations WHEN 1 BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('registrations',NEW.id,NEW.payload); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_registrations_update AFTER UPDATE OF payload ON registrations WHEN 1 AND OLD.payload IS NOT NEW.payload BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('registrations',NEW.id,NEW.payload); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_registrations_delete AFTER DELETE ON registrations WHEN 1 BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('registrations',OLD.id,NULL); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_attendance_insert AFTER INSERT ON attendance WHEN 1 BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('attendance',NEW.id,NEW.payload); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_attendance_update AFTER UPDATE OF payload ON attendance WHEN 1 AND OLD.payload IS NOT NEW.payload BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('attendance',NEW.id,NEW.payload); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_attendance_delete AFTER DELETE ON attendance WHEN 1 BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('attendance',OLD.id,NULL); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_rounds_insert AFTER INSERT ON rounds WHEN 1 BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('rounds',NEW.id,NEW.payload); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_rounds_update AFTER UPDATE OF payload ON rounds WHEN 1 AND OLD.payload IS NOT NEW.payload BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('rounds',NEW.id,NEW.payload); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_rounds_delete AFTER DELETE ON rounds WHEN 1 BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('rounds',OLD.id,NULL); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_matches_insert AFTER INSERT ON matches WHEN 1 BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('matches',NEW.id,NEW.payload); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_matches_update AFTER UPDATE OF payload ON matches WHEN 1 AND OLD.payload IS NOT NEW.payload BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('matches',NEW.id,NEW.payload); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_matches_delete AFTER DELETE ON matches WHEN 1 BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('matches',OLD.id,NULL); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_costs_insert AFTER INSERT ON costs WHEN 1 BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('costs',NEW.id,NEW.payload); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_costs_update AFTER UPDATE OF payload ON costs WHEN 1 AND OLD.payload IS NOT NEW.payload BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('costs',NEW.id,NEW.payload); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_costs_delete AFTER DELETE ON costs WHEN 1 BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('costs',OLD.id,NULL); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_settlements_insert AFTER INSERT ON settlements WHEN 1 BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('settlements',NEW.id,NEW.payload); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_settlements_update AFTER UPDATE OF payload ON settlements WHEN 1 AND OLD.payload IS NOT NEW.payload BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('settlements',NEW.id,NEW.payload); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_settlements_delete AFTER DELETE ON settlements WHEN 1 BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('settlements',OLD.id,NULL); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_payments_insert AFTER INSERT ON payments WHEN 1 BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('payments',NEW.id,NEW.payload); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_payments_update AFTER UPDATE OF payload ON payments WHEN 1 AND OLD.payload IS NOT NEW.payload BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('payments',NEW.id,NEW.payload); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_payments_delete AFTER DELETE ON payments WHEN 1 BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('payments',OLD.id,NULL); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_seasons_insert AFTER INSERT ON seasons WHEN 1 BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('seasons',NEW.id,NEW.payload); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_seasons_update AFTER UPDATE OF payload ON seasons WHEN 1 AND OLD.payload IS NOT NEW.payload BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('seasons',NEW.id,NEW.payload); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_seasons_delete AFTER DELETE ON seasons WHEN 1 BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('seasons',OLD.id,NULL); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_audits_insert AFTER INSERT ON audits WHEN 1 BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('audits',NEW.id,NEW.payload); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_audits_update AFTER UPDATE OF payload ON audits WHEN 1 AND OLD.payload IS NOT NEW.payload BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('audits',NEW.id,NEW.payload); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_audits_delete AFTER DELETE ON audits WHEN 1 BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('audits',OLD.id,NULL); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_ratingChanges_insert AFTER INSERT ON ratingChanges WHEN 1 BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('ratingChanges',NEW.id,NEW.payload); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_ratingChanges_update AFTER UPDATE OF payload ON ratingChanges WHEN 1 AND OLD.payload IS NOT NEW.payload BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('ratingChanges',NEW.id,NEW.payload); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_ratingChanges_delete AFTER DELETE ON ratingChanges WHEN 1 BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('ratingChanges',OLD.id,NULL); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_challenges_insert AFTER INSERT ON challenges WHEN 1 BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('challenges',NEW.id,NEW.payload); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_challenges_update AFTER UPDATE OF payload ON challenges WHEN 1 AND OLD.payload IS NOT NEW.payload BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('challenges',NEW.id,NEW.payload); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_challenges_delete AFTER DELETE ON challenges WHEN 1 BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('challenges',OLD.id,NULL); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_tagVotes_insert AFTER INSERT ON tagVotes WHEN 1 BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('tagVotes',NEW.id,NEW.payload); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_tagVotes_update AFTER UPDATE OF payload ON tagVotes WHEN 1 AND OLD.payload IS NOT NEW.payload BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('tagVotes',NEW.id,NEW.payload); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_tagVotes_delete AFTER DELETE ON tagVotes WHEN 1 BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('tagVotes',OLD.id,NULL); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_awardVotes_insert AFTER INSERT ON awardVotes WHEN 1 BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('awardVotes',NEW.id,NEW.payload); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_awardVotes_update AFTER UPDATE OF payload ON awardVotes WHEN 1 AND OLD.payload IS NOT NEW.payload BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('awardVotes',NEW.id,NEW.payload); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_awardVotes_delete AFTER DELETE ON awardVotes WHEN 1 BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('awardVotes',OLD.id,NULL); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_photos_insert AFTER INSERT ON photos WHEN 1 BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('photos',NEW.id,NEW.payload); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_photos_update AFTER UPDATE OF payload ON photos WHEN 1 AND OLD.payload IS NOT NEW.payload BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('photos',NEW.id,NEW.payload); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_photos_delete AFTER DELETE ON photos WHEN 1 BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('photos',OLD.id,NULL); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_treasureProducts_insert AFTER INSERT ON treasureProducts WHEN 1 BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('treasureProducts',NEW.id,NEW.payload); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_treasureProducts_update AFTER UPDATE OF payload ON treasureProducts WHEN 1 AND OLD.payload IS NOT NEW.payload BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('treasureProducts',NEW.id,NEW.payload); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_treasureProducts_delete AFTER DELETE ON treasureProducts WHEN 1 BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('treasureProducts',OLD.id,NULL); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_treasureOrders_insert AFTER INSERT ON treasureOrders WHEN 1 BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('treasureOrders',NEW.id,NEW.payload); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_treasureOrders_update AFTER UPDATE OF payload ON treasureOrders WHEN 1 AND OLD.payload IS NOT NEW.payload BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('treasureOrders',NEW.id,NEW.payload); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_treasureOrders_delete AFTER DELETE ON treasureOrders WHEN 1 BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('treasureOrders',OLD.id,NULL); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_treasureLedger_insert AFTER INSERT ON treasureLedger WHEN 1 BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('treasureLedger',NEW.id,NEW.payload); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_treasureLedger_update AFTER UPDATE OF payload ON treasureLedger WHEN 1 AND OLD.payload IS NOT NEW.payload BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('treasureLedger',NEW.id,NEW.payload); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_treasureLedger_delete AFTER DELETE ON treasureLedger WHEN 1 BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('treasureLedger',OLD.id,NULL); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_treasureRewardClaims_insert AFTER INSERT ON treasureRewardClaims WHEN 1 BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('treasureRewardClaims',NEW.id,NEW.payload); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_treasureRewardClaims_update AFTER UPDATE OF payload ON treasureRewardClaims WHEN 1 AND OLD.payload IS NOT NEW.payload BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('treasureRewardClaims',NEW.id,NEW.payload); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_treasureRewardClaims_delete AFTER DELETE ON treasureRewardClaims WHEN 1 BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('treasureRewardClaims',OLD.id,NULL); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_accountNoticeReceipts_insert AFTER INSERT ON accountNoticeReceipts WHEN 1 BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('accountNoticeReceipts',NEW.id,NEW.payload); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_accountNoticeReceipts_update AFTER UPDATE OF payload ON accountNoticeReceipts WHEN 1 AND OLD.payload IS NOT NEW.payload BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('accountNoticeReceipts',NEW.id,NEW.payload); END;
--> statement-breakpoint
CREATE TRIGGER club_sync_accountNoticeReceipts_delete AFTER DELETE ON accountNoticeReceipts WHEN 1 BEGIN INSERT INTO club_changes(table_name,row_id,payload) VALUES('accountNoticeReceipts',OLD.id,NULL); END;
