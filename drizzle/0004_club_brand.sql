-- The owner requested this exact rename. Preserve any separately customized name and invitation.
UPDATE settings
SET payload=json_set(payload,'$.name','羽林大会')
WHERE id='club' AND json_extract(payload,'$.name')='羽球局';
--> statement-breakpoint
-- Invalidate snapshots read before the rename, preventing stale writes from reverting it.
INSERT INTO commits(revision,key,at)
SELECT COALESCE(MAX(revision),0)+1,'migration:club-brand',CAST(strftime('%s','now') AS INTEGER)*1000
FROM commits HAVING changes()>0;
