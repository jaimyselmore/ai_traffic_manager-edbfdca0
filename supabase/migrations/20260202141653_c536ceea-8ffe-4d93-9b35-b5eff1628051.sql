-- ============================================================
-- DROP ALL ANONYMOUS RLS POLICIES
-- ============================================================
-- This migration removes all overly permissive 'Allow anon' policies
-- that bypass the secure edge-function architecture.
-- All data access should now go through authenticated edge functions.
-- ============================================================

-- PROJECTEN
DROP POLICY IF EXISTS "Allow anon read projecten" ON projecten;
DROP POLICY IF EXISTS "Allow anon insert projecten" ON projecten;
DROP POLICY IF EXISTS "Allow anon update projecten" ON projecten;
DROP POLICY IF EXISTS "Allow anon delete projecten" ON projecten;

-- KLANTEN
DROP POLICY IF EXISTS "Allow anon read klanten" ON klanten;
DROP POLICY IF EXISTS "Allow anon insert klanten" ON klanten;
DROP POLICY IF EXISTS "Allow anon update klanten" ON klanten;
DROP POLICY IF EXISTS "Allow anon delete klanten" ON klanten;

-- MEDEWERKERS
DROP POLICY IF EXISTS "Allow anon read medewerkers" ON medewerkers;
DROP POLICY IF EXISTS "Allow anon read werknemers" ON medewerkers;

-- NOTIFICATIES
DROP POLICY IF EXISTS "Allow anon read notificaties" ON notificaties;
DROP POLICY IF EXISTS "Allow anon update notificaties" ON notificaties;

-- PROJECT_FASES
DROP POLICY IF EXISTS "Allow anon read project_fases" ON project_fases;
DROP POLICY IF EXISTS "Allow anon insert project_fases" ON project_fases;
DROP POLICY IF EXISTS "Allow anon update project_fases" ON project_fases;
DROP POLICY IF EXISTS "Allow anon delete project_fases" ON project_fases;

-- TAKEN
DROP POLICY IF EXISTS "Allow anon read taken" ON taken;
DROP POLICY IF EXISTS "Allow anon insert taken" ON taken;
DROP POLICY IF EXISTS "Allow anon update taken" ON taken;
DROP POLICY IF EXISTS "Allow anon delete taken" ON taken;

-- MEETINGS & PRESENTATIES
DROP POLICY IF EXISTS "Allow anon read meetings" ON "meetings & presentaties";
DROP POLICY IF EXISTS "Allow anon insert meetings" ON "meetings & presentaties";
DROP POLICY IF EXISTS "Allow anon update meetings" ON "meetings & presentaties";
DROP POLICY IF EXISTS "Allow anon delete meetings" ON "meetings & presentaties";
DROP POLICY IF EXISTS "Allow anon read meetings_presentaties" ON "meetings & presentaties";
DROP POLICY IF EXISTS "Allow anon insert meetings_presentaties" ON "meetings & presentaties";
DROP POLICY IF EXISTS "Allow anon update meetings_presentaties" ON "meetings & presentaties";
DROP POLICY IF EXISTS "Allow anon delete meetings_presentaties" ON "meetings & presentaties";

-- BESCHIKBAARHEID_MEDEWERKERS
DROP POLICY IF EXISTS "Allow anon read beschikbaarheid_medewerkers" ON beschikbaarheid_medewerkers;
DROP POLICY IF EXISTS "Allow anon insert beschikbaarheid_medewerkers" ON beschikbaarheid_medewerkers;
DROP POLICY IF EXISTS "Allow anon update beschikbaarheid_medewerkers" ON beschikbaarheid_medewerkers;
DROP POLICY IF EXISTS "Allow anon delete beschikbaarheid_medewerkers" ON beschikbaarheid_medewerkers;
DROP POLICY IF EXISTS "Allow anon read verlof_aanvragen" ON beschikbaarheid_medewerkers;
DROP POLICY IF EXISTS "Allow anon insert verlof_aanvragen" ON beschikbaarheid_medewerkers;
DROP POLICY IF EXISTS "Allow anon update verlof_aanvragen" ON beschikbaarheid_medewerkers;
DROP POLICY IF EXISTS "Allow anon delete verlof_aanvragen" ON beschikbaarheid_medewerkers;

-- WIJZIGINGSVERZOEKEN
DROP POLICY IF EXISTS "Allow anon read wijzigingsverzoeken" ON wijzigingsverzoeken;
DROP POLICY IF EXISTS "Allow anon insert wijzigingsverzoeken" ON wijzigingsverzoeken;
DROP POLICY IF EXISTS "Allow anon update wijzigingsverzoeken" ON wijzigingsverzoeken;
DROP POLICY IF EXISTS "Allow anon delete wijzigingsverzoeken" ON wijzigingsverzoeken;

-- DISCIPLINES
DROP POLICY IF EXISTS "Allow anon read disciplines" ON disciplines;

-- PROJECTTYPES
DROP POLICY IF EXISTS "Allow anon read projecttypes" ON projecttypes;
DROP POLICY IF EXISTS "Allow anon insert projecttypes" ON projecttypes;
DROP POLICY IF EXISTS "Allow anon update projecttypes" ON projecttypes;
DROP POLICY IF EXISTS "Allow anon delete projecttypes" ON projecttypes;

-- ============================================================
-- ENSURE DEFAULT-DENY POLICIES EXIST
-- ============================================================
-- Add default-deny policies for tables that don't have them yet

-- Ensure RLS is enabled on all critical tables
ALTER TABLE projecten ENABLE ROW LEVEL SECURITY;
ALTER TABLE klanten ENABLE ROW LEVEL SECURITY;
ALTER TABLE medewerkers ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaties ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_fases ENABLE ROW LEVEL SECURITY;
ALTER TABLE taken ENABLE ROW LEVEL SECURITY;
ALTER TABLE "meetings & presentaties" ENABLE ROW LEVEL SECURITY;
ALTER TABLE beschikbaarheid_medewerkers ENABLE ROW LEVEL SECURITY;
ALTER TABLE wijzigingsverzoeken ENABLE ROW LEVEL SECURITY;
ALTER TABLE disciplines ENABLE ROW LEVEL SECURITY;
ALTER TABLE projecttypes ENABLE ROW LEVEL SECURITY;

-- Add default-deny policies for anonymous access (blocks anon key access)
-- Note: Service role policies already exist and will allow edge function access

DO $$
BEGIN
  -- projecten
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'projecten' AND policyname = 'Block anon access') THEN
    CREATE POLICY "Block anon access" ON projecten FOR ALL TO anon USING (false);
  END IF;
  
  -- klanten
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'klanten' AND policyname = 'Block anon access') THEN
    CREATE POLICY "Block anon access" ON klanten FOR ALL TO anon USING (false);
  END IF;
  
  -- medewerkers
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'medewerkers' AND policyname = 'Block anon access') THEN
    CREATE POLICY "Block anon access" ON medewerkers FOR ALL TO anon USING (false);
  END IF;
  
  -- notificaties
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notificaties' AND policyname = 'Block anon access') THEN
    CREATE POLICY "Block anon access" ON notificaties FOR ALL TO anon USING (false);
  END IF;
  
  -- project_fases
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_fases' AND policyname = 'Block anon access') THEN
    CREATE POLICY "Block anon access" ON project_fases FOR ALL TO anon USING (false);
  END IF;
  
  -- taken
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'taken' AND policyname = 'Block anon access') THEN
    CREATE POLICY "Block anon access" ON taken FOR ALL TO anon USING (false);
  END IF;
  
  -- meetings & presentaties
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'meetings & presentaties' AND policyname = 'Block anon access') THEN
    CREATE POLICY "Block anon access" ON "meetings & presentaties" FOR ALL TO anon USING (false);
  END IF;
  
  -- beschikbaarheid_medewerkers
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'beschikbaarheid_medewerkers' AND policyname = 'Block anon access') THEN
    CREATE POLICY "Block anon access" ON beschikbaarheid_medewerkers FOR ALL TO anon USING (false);
  END IF;
  
  -- wijzigingsverzoeken
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'wijzigingsverzoeken' AND policyname = 'Block anon access') THEN
    CREATE POLICY "Block anon access" ON wijzigingsverzoeken FOR ALL TO anon USING (false);
  END IF;
  
  -- projecttypes
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'projecttypes' AND policyname = 'Block anon access') THEN
    CREATE POLICY "Block anon access" ON projecttypes FOR ALL TO anon USING (false);
  END IF;
END $$;