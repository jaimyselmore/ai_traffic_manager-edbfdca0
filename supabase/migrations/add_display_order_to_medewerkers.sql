-- Add display_order column to medewerkers table
ALTER TABLE medewerkers ADD COLUMN IF NOT EXISTS display_order INTEGER;

-- Populate display_order for existing employees
-- This assigns sequential numbers to all existing employees
WITH numbered AS (
  SELECT
    werknemer_id,
    ROW_NUMBER() OVER (ORDER BY werknemer_id) as row_num
  FROM medewerkers
)
UPDATE medewerkers
SET display_order = numbered.row_num
FROM numbered
WHERE medewerkers.werknemer_id = numbered.werknemer_id;

-- Add comment to explain the column
COMMENT ON COLUMN medewerkers.display_order IS 'Display order for employees in planner. Auto-calculated based on primaire_rol when creating new employees.';
