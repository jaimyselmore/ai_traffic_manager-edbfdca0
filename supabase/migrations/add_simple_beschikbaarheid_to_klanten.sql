-- Migration: Add simple beschikbaarheid text field to klanten table
-- This is a simple text field like "Ma-Vr 9:00-17:00" or "Alleen dinsdag en donderdag"

ALTER TABLE klanten
ADD COLUMN IF NOT EXISTS beschikbaarheid text;

-- Add comment
COMMENT ON COLUMN klanten.beschikbaarheid IS 'Simpele tekst beschrijving van wanneer klant beschikbaar is, bijv. "Ma-Vr 9:00-17:00"';

-- Examples of what can be stored:
-- "Ma-Vr 9:00-17:00"
-- "Alleen dinsdag en donderdag ochtend"
-- "Flexibel, maar niet op maandag"
-- "Voorkeur voor middag afspraken"
