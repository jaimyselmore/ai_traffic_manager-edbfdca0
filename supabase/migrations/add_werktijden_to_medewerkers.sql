-- Migration: Add werktijden JSONB column to medewerkers table
-- This replaces the simple parttime_dag string with a flexible work schedule

-- Add werktijden column
ALTER TABLE medewerkers
ADD COLUMN IF NOT EXISTS werktijden jsonb DEFAULT '{
  "maandag": {"werkt": true, "start": 9, "eind": 17},
  "dinsdag": {"werkt": true, "start": 9, "eind": 17},
  "woensdag": {"werkt": true, "start": 9, "eind": 17},
  "donderdag": {"werkt": true, "start": 9, "eind": 17},
  "vrijdag": {"werkt": true, "start": 9, "eind": 17}
}'::jsonb;

-- Add column to track if parttime is synced to Microsoft Calendar
ALTER TABLE medewerkers
ADD COLUMN IF NOT EXISTS parttime_synced_to_microsoft boolean DEFAULT false;

-- Add column to store Microsoft Calendar event IDs for parttime days
ALTER TABLE medewerkers
ADD COLUMN IF NOT EXISTS microsoft_parttime_event_ids jsonb DEFAULT '[]'::jsonb;

-- Migrate existing parttime_dag data to werktijden
-- This sets the parttime day to werkt: false
UPDATE medewerkers
SET werktijden = jsonb_set(
  COALESCE(werktijden, '{
    "maandag": {"werkt": true, "start": 9, "eind": 17},
    "dinsdag": {"werkt": true, "start": 9, "eind": 17},
    "woensdag": {"werkt": true, "start": 9, "eind": 17},
    "donderdag": {"werkt": true, "start": 9, "eind": 17},
    "vrijdag": {"werkt": true, "start": 9, "eind": 17}
  }'::jsonb),
  ARRAY[LOWER(parttime_dag)],
  '{"werkt": false, "reden": "parttime"}'::jsonb
)
WHERE parttime_dag IS NOT NULL
  AND parttime_dag != ''
  AND LOWER(parttime_dag) IN ('maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag');

-- Update werkuren based on werktijden (count working days * 8 hours)
-- This is informational, actual hours come from werktijden

-- Create index for faster queries on werktijden
CREATE INDEX IF NOT EXISTS idx_medewerkers_werktijden ON medewerkers USING gin(werktijden);

-- Add comment explaining the structure
COMMENT ON COLUMN medewerkers.werktijden IS 'JSONB object with work schedule per day. Structure: {"maandag": {"werkt": true/false, "start": 9, "eind": 17, "reden": "optional"}, ...}';

-- Verify the migration
SELECT
  werknemer_id,
  naam_werknemer,
  parttime_dag,
  werktijden,
  werkuren
FROM medewerkers
WHERE parttime_dag IS NOT NULL AND parttime_dag != ''
LIMIT 5;
