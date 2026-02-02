-- Migration: Add change tracking columns to wijzigingsverzoeken table
-- This enables storing original and changed values for comparison

-- Add JSONB columns for storing original and changed values
ALTER TABLE wijzigingsverzoeken
ADD COLUMN IF NOT EXISTS original_values jsonb,
ADD COLUMN IF NOT EXISTS changed_values jsonb,
ADD COLUMN IF NOT EXISTS change_summary text;

-- Create index on change_summary for full-text search
CREATE INDEX IF NOT EXISTS idx_wijzigingsverzoeken_change_summary
ON wijzigingsverzoeken USING gin(to_tsvector('dutch', change_summary));

-- Create index on project_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_wijzigingsverzoeken_project_id
ON wijzigingsverzoeken(project_id);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_wijzigingsverzoeken_status
ON wijzigingsverzoeken(status);

-- Add comment to explain the columns
COMMENT ON COLUMN wijzigingsverzoeken.original_values IS 'JSONB object containing all original project field values at time of change request';
COMMENT ON COLUMN wijzigingsverzoeken.changed_values IS 'JSONB object containing only the fields that were changed (new values)';
COMMENT ON COLUMN wijzigingsverzoeken.change_summary IS 'Human-readable summary of changes (e.g., "Deadline +7 dagen, Team +1 persoon")';

-- Verify the migration
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'wijzigingsverzoeken'
AND column_name IN ('original_values', 'changed_values', 'change_summary')
ORDER BY column_name;
