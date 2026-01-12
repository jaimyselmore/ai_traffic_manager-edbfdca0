-- ============================================================
-- SUPABASE RLS SECURITY FIX v4 - COMPLETE CLEANUP
-- ============================================================
-- Dit script verwijdert ALLE bestaande policies en maakt alleen
-- service_role policies aan voor backend toegang
-- ============================================================

-- ============================================================
-- STEP 1: Drop ALLE bestaande policies op alle tabellen
-- ============================================================

-- Users tabel
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON users', r.policyname);
    END LOOP;
END $$;

-- Klanten tabel
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'klanten') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON klanten', r.policyname);
    END LOOP;
END $$;

-- Projecten tabel
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'projecten') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON projecten', r.policyname);
    END LOOP;
END $$;

-- Project_fases tabel
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'project_fases') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON project_fases', r.policyname);
    END LOOP;
END $$;

-- Taken tabel
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'taken') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON taken', r.policyname);
    END LOOP;
END $$;

-- Meetings tabel
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'meetings') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON meetings', r.policyname);
    END LOOP;
END $$;

-- Verlof_aanvragen tabel
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'verlof_aanvragen') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON verlof_aanvragen', r.policyname);
    END LOOP;
END $$;

-- Wijzigingsverzoeken tabel
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'wijzigingsverzoeken') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON wijzigingsverzoeken', r.policyname);
    END LOOP;
END $$;

-- Notificaties tabel
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notificaties') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON notificaties', r.policyname);
    END LOOP;
END $$;

-- Audit_log tabel
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'audit_log') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON audit_log', r.policyname);
    END LOOP;
END $$;

-- Werknemers tabel
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'werknemers') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON werknemers', r.policyname);
    END LOOP;
END $$;

-- Rolprofielen tabel
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'rolprofielen') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON rolprofielen', r.policyname);
    END LOOP;
END $$;

-- ============================================================
-- STEP 2: Enable RLS op alle tabellen
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE klanten ENABLE ROW LEVEL SECURITY;
ALTER TABLE projecten ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_fases ENABLE ROW LEVEL SECURITY;
ALTER TABLE taken ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE verlof_aanvragen ENABLE ROW LEVEL SECURITY;
ALTER TABLE wijzigingsverzoeken ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaties ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE werknemers ENABLE ROW LEVEL SECURITY;
ALTER TABLE rolprofielen ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 3: Maak ALLEEN service_role policies aan
-- ============================================================

-- Users
CREATE POLICY "Service role full access"
  ON users FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Klanten
CREATE POLICY "Service role full access"
  ON klanten FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Projecten
CREATE POLICY "Service role full access"
  ON projecten FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Project_fases
CREATE POLICY "Service role full access"
  ON project_fases FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Taken
CREATE POLICY "Service role full access"
  ON taken FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Meetings
CREATE POLICY "Service role full access"
  ON meetings FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Verlof_aanvragen
CREATE POLICY "Service role full access"
  ON verlof_aanvragen FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Wijzigingsverzoeken
CREATE POLICY "Service role full access"
  ON wijzigingsverzoeken FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Notificaties
CREATE POLICY "Service role full access"
  ON notificaties FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Audit_log
CREATE POLICY "Service role full access"
  ON audit_log FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Werknemers
CREATE POLICY "Service role full access"
  ON werknemers FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Rolprofielen
CREATE POLICY "Service role full access"
  ON rolprofielen FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- VERIFICATIE
-- ============================================================

-- Check alle policies
SELECT
  tablename,
  policyname,
  roles,
  cmd as operation
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Expected: Alleen "Service role full access" voor elke tabel
-- Roles moet zijn: {service_role}
-- Geen "Block direct access" policies meer

-- Check RLS status
SELECT
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'users', 'klanten', 'projecten', 'project_fases', 'taken',
    'meetings', 'verlof_aanvragen', 'wijzigingsverzoeken',
    'notificaties', 'audit_log', 'werknemers', 'rolprofielen'
  )
ORDER BY tablename;

-- Expected: rls_enabled = true voor alle tabellen

-- ============================================================
-- SECURITY MODEL
-- ============================================================
-- ✅ RLS enabled op alle tabellen
-- ✅ ALLEEN service_role heeft toegang (backend)
-- ✅ Public/authenticated/anon hebben GEEN toegang (geen policies)
-- ✅ Frontend → Backend API → Supabase (service key)
-- ✅ Alle auth/authz in backend code
-- ============================================================
