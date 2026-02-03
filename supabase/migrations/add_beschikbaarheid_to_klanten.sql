-- Migration: Add beschikbaarheid to klanten table
-- For scheduling presentations/meetings with clients

-- Add beschikbaarheid JSONB column
ALTER TABLE klanten
ADD COLUMN IF NOT EXISTS beschikbaarheid jsonb DEFAULT '{
  "maandag": {"beschikbaar": true, "start": 9, "eind": 17},
  "dinsdag": {"beschikbaar": true, "start": 9, "eind": 17},
  "woensdag": {"beschikbaar": true, "start": 9, "eind": 17},
  "donderdag": {"beschikbaar": true, "start": 9, "eind": 17},
  "vrijdag": {"beschikbaar": true, "start": 9, "eind": 17}
}'::jsonb;

-- Add voorkeur_dag column (preferred day for meetings)
ALTER TABLE klanten
ADD COLUMN IF NOT EXISTS voorkeur_dag text;

-- Add voorkeur_tijd column (preferred time)
ALTER TABLE klanten
ADD COLUMN IF NOT EXISTS voorkeur_tijd text;

-- Add comment
COMMENT ON COLUMN klanten.beschikbaarheid IS 'JSONB object with client availability per day. Structure: {"maandag": {"beschikbaar": true/false, "start": 9, "eind": 17}, ...}';
COMMENT ON COLUMN klanten.voorkeur_dag IS 'Preferred day for meetings (e.g., "dinsdag")';
COMMENT ON COLUMN klanten.voorkeur_tijd IS 'Preferred time for meetings (e.g., "ochtend" or "14:00")';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_klanten_beschikbaarheid ON klanten USING gin(beschikbaarheid);
