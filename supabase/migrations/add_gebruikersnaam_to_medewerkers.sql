-- Migration: Add gebruikersnaam column to medewerkers table
-- This supports automatic user account creation for planners

-- Add gebruikersnaam column (nullable, as not all employees are planners)
ALTER TABLE medewerkers
ADD COLUMN IF NOT EXISTS gebruikersnaam text;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_medewerkers_gebruikersnaam
ON medewerkers(gebruikersnaam);

-- Optional: Copy existing usernames from users table to medewerkers
-- This ensures consistency for existing planner accounts
UPDATE medewerkers m
SET gebruikersnaam = u.gebruikersnaam
FROM users u
WHERE u.werknemer_id = m.werknemer_id
AND m.gebruikersnaam IS NULL;

-- Verify the migration
SELECT
  COUNT(*) FILTER (WHERE gebruikersnaam IS NOT NULL) as medewerkers_met_gebruikersnaam,
  COUNT(*) FILTER (WHERE is_planner = true) as planners,
  COUNT(*) FILTER (WHERE is_planner = true AND gebruikersnaam IS NOT NULL) as planners_met_gebruikersnaam,
  COUNT(*) as totaal_medewerkers
FROM medewerkers;
