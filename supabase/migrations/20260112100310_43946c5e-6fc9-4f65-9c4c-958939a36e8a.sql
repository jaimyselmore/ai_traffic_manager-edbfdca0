-- =====================================================
-- ENABLE RLS ON ALL TABLES WITH DEFAULT-DENY POLICIES
-- Since we use custom JWT auth with edge functions (service role),
-- RLS acts as defense-in-depth to block direct client access
-- =====================================================

-- Drop all existing RLS policies (they rely on auth.uid() which doesn't work with custom auth)
-- Users table
DROP POLICY IF EXISTS "Users kunnen eigen profiel zien" ON public.users;

-- Klanten table
DROP POLICY IF EXISTS "Planners delete klanten" ON public.klanten;
DROP POLICY IF EXISTS "Planners insert klanten" ON public.klanten;
DROP POLICY IF EXISTS "Planners select klanten" ON public.klanten;
DROP POLICY IF EXISTS "Planners update klanten" ON public.klanten;

-- Werknemers table
DROP POLICY IF EXISTS "Planners kunnen werknemers bewerken" ON public.werknemers;
DROP POLICY IF EXISTS "Planners kunnen werknemers lezen" ON public.werknemers;

-- Rolprofielen table
DROP POLICY IF EXISTS "Planners delete rollen" ON public.rolprofielen;
DROP POLICY IF EXISTS "Planners insert rollen" ON public.rolprofielen;
DROP POLICY IF EXISTS "Planners kunnen rollen lezen" ON public.rolprofielen;
DROP POLICY IF EXISTS "Planners update rollen" ON public.rolprofielen;

-- Disciplines table
DROP POLICY IF EXISTS "Planners delete disciplines" ON public.disciplines;
DROP POLICY IF EXISTS "Planners insert disciplines" ON public.disciplines;
DROP POLICY IF EXISTS "Planners kunnen disciplines lezen" ON public.disciplines;
DROP POLICY IF EXISTS "Planners update disciplines" ON public.disciplines;

-- Project_fases table
DROP POLICY IF EXISTS "Planners delete fases" ON public.project_fases;
DROP POLICY IF EXISTS "Planners insert fases" ON public.project_fases;
DROP POLICY IF EXISTS "Planners select fases" ON public.project_fases;
DROP POLICY IF EXISTS "Planners update fases" ON public.project_fases;

-- Taken table
DROP POLICY IF EXISTS "Planners delete taken" ON public.taken;
DROP POLICY IF EXISTS "Planners insert taken" ON public.taken;
DROP POLICY IF EXISTS "Planners select taken" ON public.taken;
DROP POLICY IF EXISTS "Planners update taken" ON public.taken;

-- Meetings table
DROP POLICY IF EXISTS "Planners delete meetings" ON public.meetings;
DROP POLICY IF EXISTS "Planners insert meetings" ON public.meetings;
DROP POLICY IF EXISTS "Planners select meetings" ON public.meetings;
DROP POLICY IF EXISTS "Planners update meetings" ON public.meetings;

-- Verlof_aanvragen table
DROP POLICY IF EXISTS "Planners delete verlof" ON public.verlof_aanvragen;
DROP POLICY IF EXISTS "Planners insert verlof" ON public.verlof_aanvragen;
DROP POLICY IF EXISTS "Planners select verlof" ON public.verlof_aanvragen;
DROP POLICY IF EXISTS "Planners update verlof" ON public.verlof_aanvragen;

-- Wijzigingsverzoeken table
DROP POLICY IF EXISTS "Planners delete wijzigingen" ON public.wijzigingsverzoeken;
DROP POLICY IF EXISTS "Planners insert wijzigingen" ON public.wijzigingsverzoeken;
DROP POLICY IF EXISTS "Planners select wijzigingen" ON public.wijzigingsverzoeken;
DROP POLICY IF EXISTS "Planners update wijzigingen" ON public.wijzigingsverzoeken;

-- Notificaties table
DROP POLICY IF EXISTS "Planners delete notificaties" ON public.notificaties;
DROP POLICY IF EXISTS "Planners insert notificaties" ON public.notificaties;
DROP POLICY IF EXISTS "Planners select notificaties" ON public.notificaties;
DROP POLICY IF EXISTS "Planners update notificaties" ON public.notificaties;

-- Audit_log table
DROP POLICY IF EXISTS "Planners insert audit" ON public.audit_log;
DROP POLICY IF EXISTS "Planners select audit" ON public.audit_log;

-- Planning_regels table
DROP POLICY IF EXISTS "Planners kunnen regels lezen" ON public.planning_regels;

-- Projecten table (no existing policies but for safety)
DROP POLICY IF EXISTS "Planners delete projecten" ON public.projecten;
DROP POLICY IF EXISTS "Planners insert projecten" ON public.projecten;
DROP POLICY IF EXISTS "Planners select projecten" ON public.projecten;
DROP POLICY IF EXISTS "Planners update projecten" ON public.projecten;

-- =====================================================
-- ENABLE RLS ON ALL TABLES
-- =====================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.klanten ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.werknemers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rolprofielen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disciplines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_fases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taken ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verlof_aanvragen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wijzigingsverzoeken ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificaties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planning_regels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projecten ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- CREATE DEFAULT-DENY POLICIES
-- These block ALL direct client access via anon key
-- Only service role (used by edge functions) can bypass
-- =====================================================

-- Users table - CRITICAL: blocks password hash exposure
CREATE POLICY "Block direct access to users" ON public.users
  FOR ALL USING (false);

-- All other tables - block direct access, only edge functions with service role can access
CREATE POLICY "Block direct access to klanten" ON public.klanten
  FOR ALL USING (false);

CREATE POLICY "Block direct access to werknemers" ON public.werknemers
  FOR ALL USING (false);

CREATE POLICY "Block direct access to rolprofielen" ON public.rolprofielen
  FOR ALL USING (false);

CREATE POLICY "Block direct access to disciplines" ON public.disciplines
  FOR ALL USING (false);

CREATE POLICY "Block direct access to project_fases" ON public.project_fases
  FOR ALL USING (false);

CREATE POLICY "Block direct access to taken" ON public.taken
  FOR ALL USING (false);

CREATE POLICY "Block direct access to meetings" ON public.meetings
  FOR ALL USING (false);

CREATE POLICY "Block direct access to verlof_aanvragen" ON public.verlof_aanvragen
  FOR ALL USING (false);

CREATE POLICY "Block direct access to wijzigingsverzoeken" ON public.wijzigingsverzoeken
  FOR ALL USING (false);

CREATE POLICY "Block direct access to notificaties" ON public.notificaties
  FOR ALL USING (false);

CREATE POLICY "Block direct access to audit_log" ON public.audit_log
  FOR ALL USING (false);

CREATE POLICY "Block direct access to planning_regels" ON public.planning_regels
  FOR ALL USING (false);

CREATE POLICY "Block direct access to projecten" ON public.projecten
  FOR ALL USING (false);

-- =====================================================
-- CREATE LOGIN ATTEMPTS TABLE FOR RATE LIMITING
-- =====================================================
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  ip_address text,
  success boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS and block direct access
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Block direct access to login_attempts" ON public.login_attempts
  FOR ALL USING (false);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_login_attempts_email_created 
  ON public.login_attempts(email, created_at DESC);

-- Cleanup function to remove old login attempts (older than 24 hours)
CREATE OR REPLACE FUNCTION public.cleanup_old_login_attempts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.login_attempts 
  WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$;