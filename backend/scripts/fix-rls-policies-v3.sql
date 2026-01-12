-- ============================================================
-- SUPABASE RLS SECURITY FIX v3 - FINAL SOLUTION
-- ============================================================
-- Dit script implementeert CORRECTE RLS policies voor custom JWT auth
--
-- STRATEGIE:
-- - RLS ENABLED op alle tabellen (voor Supabase security scan)
-- - Service role key heeft volledige toegang (backend)
-- - Anon key heeft GEEN toegang (frontend mag niet direct naar DB)
-- - Backend API doet alle auth/authz checks
-- ============================================================

-- ============================================================
-- 1. USERS TABEL - Service Role Only
-- ============================================================

-- Drop oude policies
DROP POLICY IF EXISTS "Users kunnen hun eigen profiel zien" ON users;
DROP POLICY IF EXISTS "Planners kunnen werknemers bewerken" ON users;
DROP POLICY IF EXISTS "Alleen planners kunnen users lezen" ON users;
DROP POLICY IF EXISTS "Alleen planners kunnen users updaten" ON users;

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Service role heeft volledige toegang
CREATE POLICY "Service role full access"
  ON users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Anon key heeft GEEN toegang (frontend gaat via backend)
-- Geen policy = geen toegang voor anon key

-- ============================================================
-- 2. KLANTEN TABEL - Service Role Only
-- ============================================================

DROP POLICY IF EXISTS "Planners kunnen alles lezen" ON klanten;
DROP POLICY IF EXISTS "Planners kunnen alles maken" ON klanten;
DROP POLICY IF EXISTS "Planners kunnen alles updaten" ON klanten;
DROP POLICY IF EXISTS "Planners kunnen alles verwijderen" ON klanten;
DROP POLICY IF EXISTS "Alleen planners kunnen klanten lezen" ON klanten;
DROP POLICY IF EXISTS "Alleen planners kunnen klanten aanmaken" ON klanten;
DROP POLICY IF EXISTS "Alleen planners kunnen klanten updaten" ON klanten;
DROP POLICY IF EXISTS "Alleen planners kunnen klanten verwijderen" ON klanten;

ALTER TABLE klanten ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access"
  ON klanten
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 3. PROJECTEN TABEL - Service Role Only
-- ============================================================

DROP POLICY IF EXISTS "Planners kunnen alles lezen" ON projecten;
DROP POLICY IF EXISTS "Planners kunnen alles maken" ON projecten;
DROP POLICY IF EXISTS "Planners kunnen alles updaten" ON projecten;
DROP POLICY IF EXISTS "Planners kunnen alles verwijderen" ON projecten;
DROP POLICY IF EXISTS "Alleen planners kunnen projecten lezen" ON projecten;
DROP POLICY IF EXISTS "Alleen planners kunnen projecten aanmaken" ON projecten;
DROP POLICY IF EXISTS "Alleen planners kunnen projecten updaten" ON projecten;
DROP POLICY IF EXISTS "Alleen planners kunnen projecten verwijderen" ON projecten;

ALTER TABLE projecten ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access"
  ON projecten
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 4. PROJECT_FASES TABEL - Service Role Only
-- ============================================================

DROP POLICY IF EXISTS "Planners kunnen alles lezen" ON project_fases;
DROP POLICY IF EXISTS "Planners kunnen alles maken" ON project_fases;
DROP POLICY IF EXISTS "Planners kunnen alles updaten" ON project_fases;
DROP POLICY IF EXISTS "Planners kunnen alles verwijderen" ON project_fases;
DROP POLICY IF EXISTS "Alleen planners kunnen project_fases lezen" ON project_fases;
DROP POLICY IF EXISTS "Alleen planners kunnen project_fases aanmaken" ON project_fases;
DROP POLICY IF EXISTS "Alleen planners kunnen project_fases updaten" ON project_fases;
DROP POLICY IF EXISTS "Alleen planners kunnen project_fases verwijderen" ON project_fases;

ALTER TABLE project_fases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access"
  ON project_fases
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 5. TAKEN TABEL - Service Role Only
-- ============================================================

DROP POLICY IF EXISTS "Planners kunnen alles lezen" ON taken;
DROP POLICY IF EXISTS "Planners kunnen alles maken" ON taken;
DROP POLICY IF EXISTS "Planners kunnen alles updaten" ON taken;
DROP POLICY IF EXISTS "Planners kunnen alles verwijderen" ON taken;
DROP POLICY IF EXISTS "Alleen planners kunnen taken lezen" ON taken;
DROP POLICY IF EXISTS "Alleen planners kunnen taken aanmaken" ON taken;
DROP POLICY IF EXISTS "Alleen planners kunnen taken updaten" ON taken;
DROP POLICY IF EXISTS "Alleen planners kunnen taken verwijderen" ON taken;

ALTER TABLE taken ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access"
  ON taken
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 6. MEETINGS TABEL - Service Role Only
-- ============================================================

DROP POLICY IF EXISTS "Planners kunnen alles lezen" ON meetings;
DROP POLICY IF EXISTS "Planners kunnen alles maken" ON meetings;
DROP POLICY IF EXISTS "Planners kunnen alles updaten" ON meetings;
DROP POLICY IF EXISTS "Planners kunnen alles verwijderen" ON meetings;
DROP POLICY IF EXISTS "Alleen planners kunnen meetings lezen" ON meetings;
DROP POLICY IF EXISTS "Alleen planners kunnen meetings aanmaken" ON meetings;
DROP POLICY IF EXISTS "Alleen planners kunnen meetings updaten" ON meetings;
DROP POLICY IF EXISTS "Alleen planners kunnen meetings verwijderen" ON meetings;

ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access"
  ON meetings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 7. VERLOF_AANVRAGEN TABEL - Service Role Only
-- ============================================================

DROP POLICY IF EXISTS "Planners kunnen alles lezen" ON verlof_aanvragen;
DROP POLICY IF EXISTS "Planners kunnen alles maken" ON verlof_aanvragen;
DROP POLICY IF EXISTS "Planners kunnen alles updaten" ON verlof_aanvragen;
DROP POLICY IF EXISTS "Planners kunnen alles verwijderen" ON verlof_aanvragen;
DROP POLICY IF EXISTS "Alleen planners kunnen verlof_aanvragen lezen" ON verlof_aanvragen;
DROP POLICY IF EXISTS "Alleen planners kunnen verlof_aanvragen aanmaken" ON verlof_aanvragen;
DROP POLICY IF EXISTS "Alleen planners kunnen verlof_aanvragen updaten" ON verlof_aanvragen;
DROP POLICY IF EXISTS "Alleen planners kunnen verlof_aanvragen verwijderen" ON verlof_aanvragen;

ALTER TABLE verlof_aanvragen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access"
  ON verlof_aanvragen
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 8. WIJZIGINGSVERZOEKEN TABEL - Service Role Only
-- ============================================================

DROP POLICY IF EXISTS "Planners kunnen alles lezen" ON wijzigingsverzoeken;
DROP POLICY IF EXISTS "Planners kunnen alles maken" ON wijzigingsverzoeken;
DROP POLICY IF EXISTS "Planners kunnen alles updaten" ON wijzigingsverzoeken;
DROP POLICY IF EXISTS "Planners kunnen alles verwijderen" ON wijzigingsverzoeken;
DROP POLICY IF EXISTS "Alleen planners kunnen wijzigingsverzoeken lezen" ON wijzigingsverzoeken;
DROP POLICY IF EXISTS "Alleen planners kunnen wijzigingsverzoeken aanmaken" ON wijzigingsverzoeken;
DROP POLICY IF EXISTS "Alleen planners kunnen wijzigingsverzoeken updaten" ON wijzigingsverzoeken;
DROP POLICY IF EXISTS "Alleen planners kunnen wijzigingsverzoeken verwijderen" ON wijzigingsverzoeken;

ALTER TABLE wijzigingsverzoeken ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access"
  ON wijzigingsverzoeken
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 9. NOTIFICATIES TABEL - Service Role Only
-- ============================================================

DROP POLICY IF EXISTS "Planners kunnen alles lezen" ON notificaties;
DROP POLICY IF EXISTS "Planners kunnen alles maken" ON notificaties;
DROP POLICY IF EXISTS "Planners kunnen alles updaten" ON notificaties;
DROP POLICY IF EXISTS "Planners kunnen alles verwijderen" ON notificaties;
DROP POLICY IF EXISTS "Alleen planners kunnen notificaties lezen" ON notificaties;
DROP POLICY IF EXISTS "Alleen planners kunnen notificaties aanmaken" ON notificaties;
DROP POLICY IF EXISTS "Alleen planners kunnen notificaties updaten" ON notificaties;
DROP POLICY IF EXISTS "Alleen planners kunnen notificaties verwijderen" ON notificaties;

ALTER TABLE notificaties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access"
  ON notificaties
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 10. AUDIT_LOG TABEL - Service Role Only (INSERT + SELECT)
-- ============================================================

DROP POLICY IF EXISTS "Planners kunnen alles lezen" ON audit_log;
DROP POLICY IF EXISTS "Planners kunnen alles maken" ON audit_log;
DROP POLICY IF EXISTS "Planners kunnen alles updaten" ON audit_log;
DROP POLICY IF EXISTS "Planners kunnen alles verwijderen" ON audit_log;
DROP POLICY IF EXISTS "Alleen planners kunnen audit_log lezen" ON audit_log;
DROP POLICY IF EXISTS "Alleen planners kunnen audit_log aanmaken" ON audit_log;

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access"
  ON audit_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- VERIFICATIE
-- ============================================================

-- Check RLS is enabled
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'users',
    'klanten',
    'projecten',
    'project_fases',
    'taken',
    'meetings',
    'verlof_aanvragen',
    'wijzigingsverzoeken',
    'notificaties',
    'audit_log'
  )
ORDER BY tablename;

-- Expected: rls_enabled = true voor alle tabellen

-- Check policies
SELECT
  schemaname,
  tablename,
  policyname,
  roles,
  cmd as operation
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Expected: "Service role full access" policy voor elke tabel
-- Roles = {service_role}

-- ============================================================
-- SECURITY MODEL - FINAL
-- ============================================================
-- ✅ RLS ENABLED op alle tabellen (Supabase security scan happy)
-- ✅ Service role (backend) heeft volledige toegang
-- ✅ Anon key (frontend) heeft GEEN toegang (policies ontbreken)
-- ✅ Frontend → Backend API (localhost:3001) → Supabase (service key)
-- ✅ Backend valideert JWT tokens en is_planner checks
-- ✅ Geen directe database toegang voor frontend
-- ✅ Password hashes blijven beschermd (alleen backend kan lezen)
-- ✅ Klantdata blijft beschermd (alleen backend kan lezen)
-- ============================================================
