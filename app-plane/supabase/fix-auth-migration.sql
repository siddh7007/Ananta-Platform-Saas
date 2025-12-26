-- Fix for GoTrue migration failure
-- The migration 20221208132122_backfill_email_last_sign_in_at.up.sql has a bug
-- where it compares uuid = text without proper casting

-- Mark the migration as completed in the schema_migrations table
INSERT INTO auth.schema_migrations (version)
VALUES ('20221208132122')
ON CONFLICT (version) DO NOTHING;

-- If there are any records that need the backfill, fix them properly
-- (This is safer than the original migration which had the casting bug)
UPDATE auth.identities
SET last_sign_in_at = '2022-11-25'
WHERE
  last_sign_in_at IS NULL AND
  created_at = '2022-11-25' AND
  updated_at = '2022-11-25' AND
  provider = 'email' AND
  id::text = user_id::text;  -- Proper casting on both sides
