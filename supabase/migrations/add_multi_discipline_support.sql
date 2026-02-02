-- Add multi-discipline support to medewerkers table
-- Allows employees (especially interns) to have multiple disciplines

-- Add additional discipline columns
ALTER TABLE medewerkers
ADD COLUMN IF NOT EXISTS discipline_2 TEXT,
ADD COLUMN IF NOT EXISTS discipline_3 TEXT;

-- Add comments for clarity
COMMENT ON COLUMN medewerkers.discipline IS 'Primaire discipline van de medewerker';
COMMENT ON COLUMN medewerkers.discipline_2 IS 'Tweede discipline (optioneel, vooral voor stagiairs die multidisciplinair werken)';
COMMENT ON COLUMN medewerkers.discipline_3 IS 'Derde discipline (optioneel, vooral voor stagiairs die multidisciplinair werken)';

-- Verify the changes
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'medewerkers'
AND column_name IN ('discipline', 'discipline_2', 'discipline_3')
ORDER BY column_name;
