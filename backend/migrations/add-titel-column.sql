-- Migration: Add titel column to projecten and taken tables
-- Purpose: Store project title in format {klantnaam}_{volledigProjectId}
-- Example: "Selmore_12345601"
-- Date: 2026-01-27

-- Add titel column to projecten table
ALTER TABLE projecten
ADD COLUMN IF NOT EXISTS titel TEXT;

-- Add index for fast lookup by titel
CREATE INDEX IF NOT EXISTS idx_projecten_titel ON projecten(titel);

-- Add comment
COMMENT ON COLUMN projecten.titel IS 'Project title in format: {klantnaam}_{projectnummer}. Used in planner and AI agent communication.';

-- Add titel column to taken table (for faster lookup without join)
ALTER TABLE taken
ADD COLUMN IF NOT EXISTS project_titel TEXT;

-- Add index for fast lookup
CREATE INDEX IF NOT EXISTS idx_taken_project_titel ON taken(project_titel);

-- Add comment
COMMENT ON COLUMN taken.project_titel IS 'Denormalized project title for faster planner lookups. Matches projecten.titel.';

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Migration completed: titel columns added to projecten and taken tables';
END $$;
