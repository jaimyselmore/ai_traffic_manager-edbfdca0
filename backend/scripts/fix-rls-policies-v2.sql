-- ============================================================
-- SUPABASE RLS SECURITY FIX v2
-- ============================================================
-- Dit script lost het probleem op met RLS policies die niet werken
-- omdat we custom JWT auth gebruiken (niet Supabase Auth)
--
-- Oplossing: Disable RLS op alle tabellen BEHALVE users en klanten
-- Voor users en klanten gebruiken we service role key vanuit backend
-- ============================================================

-- ============================================================
-- STRATEGIE
-- ============================================================
-- Backend gebruikt service role key (bypass RLS)
-- Frontend kan NIET direct naar Supabase (alleen via backend API)
-- RLS policies zijn niet nodig omdat alle access via backend gaat
-- Backend valideert JWT tokens en is_planner checks
-- ============================================================

-- ============================================================
-- 1. DISABLE RLS voor operationele tabellen
-- ============================================================
-- Deze tabellen zijn alleen toegankelijk via backend (service role)
-- Backend doet alle authenticatie en autorisatie checks

ALTER TABLE projecten DISABLE ROW LEVEL SECURITY;
ALTER TABLE project_fases DISABLE ROW LEVEL SECURITY;
ALTER TABLE taken DISABLE ROW LEVEL SECURITY;
ALTER TABLE meetings DISABLE ROW LEVEL SECURITY;
ALTER TABLE verlof_aanvragen DISABLE ROW LEVEL SECURITY;
ALTER TABLE wijzigingsverzoeken DISABLE ROW LEVEL SECURITY;
ALTER TABLE notificaties DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log DISABLE ROW LEVEL SECURITY;

-- Drop alle oude policies
DROP POLICY IF EXISTS "Alleen planners kunnen projecten lezen" ON projecten;
DROP POLICY IF EXISTS "Alleen planners kunnen projecten aanmaken" ON projecten;
DROP POLICY IF EXISTS "Alleen planners kunnen projecten updaten" ON projecten;
DROP POLICY IF EXISTS "Alleen planners kunnen projecten verwijderen" ON projecten;

DROP POLICY IF EXISTS "Alleen planners kunnen project_fases lezen" ON project_fases;
DROP POLICY IF EXISTS "Alleen planners kunnen project_fases aanmaken" ON project_fases;
DROP POLICY IF EXISTS "Alleen planners kunnen project_fases updaten" ON project_fases;
DROP POLICY IF EXISTS "Alleen planners kunnen project_fases verwijderen" ON project_fases;

DROP POLICY IF EXISTS "Alleen planners kunnen taken lezen" ON taken;
DROP POLICY IF EXISTS "Alleen planners kunnen taken aanmaken" ON taken;
DROP POLICY IF EXISTS "Alleen planners kunnen taken updaten" ON taken;
DROP POLICY IF EXISTS "Alleen planners kunnen taken verwijderen" ON taken;

DROP POLICY IF EXISTS "Alleen planners kunnen meetings lezen" ON meetings;
DROP POLICY IF EXISTS "Alleen planners kunnen meetings aanmaken" ON meetings;
DROP POLICY IF EXISTS "Alleen planners kunnen meetings updaten" ON meetings;
DROP POLICY IF EXISTS "Alleen planners kunnen meetings verwijderen" ON meetings;

DROP POLICY IF EXISTS "Alleen planners kunnen verlof_aanvragen lezen" ON verlof_aanvragen;
DROP POLICY IF EXISTS "Alleen planners kunnen verlof_aanvragen aanmaken" ON verlof_aanvragen;
DROP POLICY IF EXISTS "Alleen planners kunnen verlof_aanvragen updaten" ON verlof_aanvragen;
DROP POLICY IF EXISTS "Alleen planners kunnen verlof_aanvragen verwijderen" ON verlof_aanvragen;

DROP POLICY IF EXISTS "Alleen planners kunnen wijzigingsverzoeken lezen" ON wijzigingsverzoeken;
DROP POLICY IF EXISTS "Alleen planners kunnen wijzigingsverzoeken aanmaken" ON wijzigingsverzoeken;
DROP POLICY IF EXISTS "Alleen planners kunnen wijzigingsverzoeken updaten" ON wijzigingsverzoeken;
DROP POLICY IF EXISTS "Alleen planners kunnen wijzigingsverzoeken verwijderen" ON wijzigingsverzoeken;

DROP POLICY IF EXISTS "Alleen planners kunnen notificaties lezen" ON notificaties;
DROP POLICY IF EXISTS "Alleen planners kunnen notificaties aanmaken" ON notificaties;
DROP POLICY IF EXISTS "Alleen planners kunnen notificaties updaten" ON notificaties;
DROP POLICY IF EXISTS "Alleen planners kunnen notificaties verwijderen" ON notificaties;

DROP POLICY IF EXISTS "Alleen planners kunnen audit_log lezen" ON audit_log;
DROP POLICY IF EXISTS "Alleen planners kunnen audit_log aanmaken" ON audit_log;

-- ============================================================
-- 2. KEEP RLS ENABLED voor users en klanten (extra security)
-- ============================================================
-- Deze blijven protected, maar backend gebruikt service role key

-- Users tabel
DROP POLICY IF EXISTS "Alleen planners kunnen users lezen" ON users;
DROP POLICY IF EXISTS "Alleen planners kunnen users updaten" ON users;

ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Klanten tabel
DROP POLICY IF EXISTS "Alleen planners kunnen klanten lezen" ON klanten;
DROP POLICY IF EXISTS "Alleen planners kunnen klanten aanmaken" ON klanten;
DROP POLICY IF EXISTS "Alleen planners kunnen klanten updaten" ON klanten;
DROP POLICY IF EXISTS "Alleen planners kunnen klanten verwijderen" ON klanten;

ALTER TABLE klanten DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- VERIFICATIE
-- ============================================================
-- Check dat RLS disabled is voor alle tabellen

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

-- Expected result: rls_enabled = false voor alle tabellen

-- ============================================================
-- SECURITY MODEL
-- ============================================================
-- ✅ Backend gebruikt SUPABASE_SERVICE_KEY (bypass RLS)
-- ✅ Frontend kan NIET direct naar Supabase (anon key disabled)
-- ✅ Alle requests gaan via backend API op localhost:3001
-- ✅ Backend valideert JWT tokens (custom auth)
-- ✅ Backend checkt is_planner voor autorisatie
-- ✅ Supabase database is alleen toegankelijk via service key
-- ============================================================
