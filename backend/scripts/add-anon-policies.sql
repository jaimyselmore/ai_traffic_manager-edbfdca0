-- ============================================================
-- RLS POLICIES VOOR ANON KEY (Frontend toegang)
-- ============================================================
-- Dit script voegt RLS policies toe zodat de frontend met de
-- anon key data kan lezen/schrijven uit Supabase.
--
-- BELANGRIJK: Run dit script in de Supabase SQL Editor!
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
-- MEETINGS - Volledige CRUD toegang
-- ============================================================

CREATE POLICY "Allow anon read meetings"
  ON meetings FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert meetings"
  ON meetings FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon update meetings"
  ON meetings FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon delete meetings"
  ON meetings FOR DELETE
  TO anon
  USING (true);

-- ============================================================
-- VERLOF_AANVRAGEN - Volledige CRUD toegang
-- ============================================================

CREATE POLICY "Allow anon read verlof_aanvragen"
  ON verlof_aanvragen FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert verlof_aanvragen"
  ON verlof_aanvragen FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon update verlof_aanvragen"
  ON verlof_aanvragen FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon delete verlof_aanvragen"
  ON verlof_aanvragen FOR DELETE
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
    'projecten', 'project_fases', 'meetings', 'verlof_aanvragen',
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
