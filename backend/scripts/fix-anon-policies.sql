-- ============================================================
-- RLS POLICIES FIXEN VOOR ANON KEY (Frontend toegang)
-- ============================================================
-- Dit script verwijdert EERST alle bestaande anon policies
-- en maakt ze daarna opnieuw aan.
--
-- BELANGRIJK: Run dit script in de Supabase SQL Editor!
-- ============================================================

-- ============================================================
-- STAP 1: VERWIJDER ALLE BESTAANDE ANON POLICIES
-- ============================================================

-- Medewerkers policies
DROP POLICY IF EXISTS "Allow anon read medewerkers" ON medewerkers;

-- Klanten policies
DROP POLICY IF EXISTS "Allow anon read klanten" ON klanten;
DROP POLICY IF EXISTS "Allow anon insert klanten" ON klanten;
DROP POLICY IF EXISTS "Allow anon update klanten" ON klanten;
DROP POLICY IF EXISTS "Allow anon delete klanten" ON klanten;

-- Disciplines policies
DROP POLICY IF EXISTS "Allow anon read disciplines" ON disciplines;

-- Taken policies
DROP POLICY IF EXISTS "Allow anon read taken" ON taken;
DROP POLICY IF EXISTS "Allow anon insert taken" ON taken;
DROP POLICY IF EXISTS "Allow anon update taken" ON taken;
DROP POLICY IF EXISTS "Allow anon delete taken" ON taken;

-- Notificaties policies
DROP POLICY IF EXISTS "Allow anon read notificaties" ON notificaties;
DROP POLICY IF EXISTS "Allow anon update notificaties" ON notificaties;

-- Projecten policies
DROP POLICY IF EXISTS "Allow anon read projecten" ON projecten;
DROP POLICY IF EXISTS "Allow anon insert projecten" ON projecten;
DROP POLICY IF EXISTS "Allow anon update projecten" ON projecten;
DROP POLICY IF EXISTS "Allow anon delete projecten" ON projecten;

-- Project_fases policies
DROP POLICY IF EXISTS "Allow anon read project_fases" ON project_fases;
DROP POLICY IF EXISTS "Allow anon insert project_fases" ON project_fases;
DROP POLICY IF EXISTS "Allow anon update project_fases" ON project_fases;
DROP POLICY IF EXISTS "Allow anon delete project_fases" ON project_fases;

-- Meetings & presentaties policies
DROP POLICY IF EXISTS "Allow anon read meetings_presentaties" ON "meetings & presentaties";
DROP POLICY IF EXISTS "Allow anon insert meetings_presentaties" ON "meetings & presentaties";
DROP POLICY IF EXISTS "Allow anon update meetings_presentaties" ON "meetings & presentaties";
DROP POLICY IF EXISTS "Allow anon delete meetings_presentaties" ON "meetings & presentaties";

-- Beschikbaarheid_medewerkers policies
DROP POLICY IF EXISTS "Allow anon read beschikbaarheid_medewerkers" ON beschikbaarheid_medewerkers;
DROP POLICY IF EXISTS "Allow anon insert beschikbaarheid_medewerkers" ON beschikbaarheid_medewerkers;
DROP POLICY IF EXISTS "Allow anon update beschikbaarheid_medewerkers" ON beschikbaarheid_medewerkers;
DROP POLICY IF EXISTS "Allow anon delete beschikbaarheid_medewerkers" ON beschikbaarheid_medewerkers;

-- Wijzigingsverzoeken policies
DROP POLICY IF EXISTS "Allow anon read wijzigingsverzoeken" ON wijzigingsverzoeken;
DROP POLICY IF EXISTS "Allow anon insert wijzigingsverzoeken" ON wijzigingsverzoeken;
DROP POLICY IF EXISTS "Allow anon update wijzigingsverzoeken" ON wijzigingsverzoeken;
DROP POLICY IF EXISTS "Allow anon delete wijzigingsverzoeken" ON wijzigingsverzoeken;

-- ============================================================
-- STAP 2: MAAK NIEUWE ANON POLICIES AAN
-- ============================================================

-- ============================================================
-- MEDEWERKERS - Alleen lezen
-- ============================================================

CREATE POLICY "Allow anon read medewerkers"
  ON medewerkers FOR SELECT
  TO anon
  USING (true);

-- ============================================================
-- KLANTEN - Lezen en schrijven
-- ============================================================

CREATE POLICY "Allow anon read klanten"
  ON klanten FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert klanten"
  ON klanten FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon update klanten"
  ON klanten FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon delete klanten"
  ON klanten FOR DELETE
  TO anon
  USING (true);

-- ============================================================
-- DISCIPLINES - Alleen lezen
-- ============================================================

CREATE POLICY "Allow anon read disciplines"
  ON disciplines FOR SELECT
  TO anon
  USING (true);

-- ============================================================
-- TAKEN - Volledige CRUD toegang
-- ============================================================

CREATE POLICY "Allow anon read taken"
  ON taken FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert taken"
  ON taken FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon update taken"
  ON taken FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon delete taken"
  ON taken FOR DELETE
  TO anon
  USING (true);

-- ============================================================
-- NOTIFICATIES - Lezen en updaten (geen delete)
-- ============================================================

CREATE POLICY "Allow anon read notificaties"
  ON notificaties FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon update notificaties"
  ON notificaties FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- PROJECTEN - Volledige CRUD toegang
-- ============================================================

CREATE POLICY "Allow anon read projecten"
  ON projecten FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert projecten"
  ON projecten FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon update projecten"
  ON projecten FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon delete projecten"
  ON projecten FOR DELETE
  TO anon
  USING (true);

-- ============================================================
-- PROJECT_FASES - Volledige CRUD toegang
-- ============================================================

CREATE POLICY "Allow anon read project_fases"
  ON project_fases FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert project_fases"
  ON project_fases FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon update project_fases"
  ON project_fases FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon delete project_fases"
  ON project_fases FOR DELETE
  TO anon
  USING (true);

-- ============================================================
-- MEETINGS & PRESENTATIES - Volledige CRUD toegang
-- ============================================================

CREATE POLICY "Allow anon read meetings_presentaties"
  ON "meetings & presentaties" FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert meetings_presentaties"
  ON "meetings & presentaties" FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon update meetings_presentaties"
  ON "meetings & presentaties" FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon delete meetings_presentaties"
  ON "meetings & presentaties" FOR DELETE
  TO anon
  USING (true);

-- ============================================================
-- BESCHIKBAARHEID_MEDEWERKERS - Volledige CRUD toegang
-- ============================================================

CREATE POLICY "Allow anon read beschikbaarheid_medewerkers"
  ON beschikbaarheid_medewerkers FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert beschikbaarheid_medewerkers"
  ON beschikbaarheid_medewerkers FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon update beschikbaarheid_medewerkers"
  ON beschikbaarheid_medewerkers FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon delete beschikbaarheid_medewerkers"
  ON beschikbaarheid_medewerkers FOR DELETE
  TO anon
  USING (true);

-- ============================================================
-- WIJZIGINGSVERZOEKEN - Volledige CRUD toegang
-- ============================================================

CREATE POLICY "Allow anon read wijzigingsverzoeken"
  ON wijzigingsverzoeken FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert wijzigingsverzoeken"
  ON wijzigingsverzoeken FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon update wijzigingsverzoeken"
  ON wijzigingsverzoeken FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon delete wijzigingsverzoeken"
  ON wijzigingsverzoeken FOR DELETE
  TO anon
  USING (true);

-- ============================================================
-- VERIFICATIE QUERIES
-- ============================================================

-- Check alle policies (moet nu anon policies tonen)
SELECT
  tablename,
  policyname,
  roles,
  cmd as operation
FROM pg_policies
WHERE schemaname = 'public'
  AND 'anon' = ANY(roles)
ORDER BY tablename, policyname;

-- Check RLS status (moet true zijn)
SELECT
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'medewerkers', 'klanten', 'disciplines', 'taken', 'notificaties',
    'projecten', 'project_fases', 'meetings & presentaties', 'beschikbaarheid_medewerkers',
    'wijzigingsverzoeken'
  )
ORDER BY tablename;

-- ============================================================
-- SECURITY MODEL
-- ============================================================
-- ✅ RLS enabled op alle tabellen
-- ✅ Service role heeft full access (voor backend)
-- ✅ Anon role heeft CRUD access (voor frontend)
-- ✅ Frontend → Direct naar Supabase met anon key
-- ✅ Geen authenticated users (login gaat via backend API nog)
-- ============================================================
