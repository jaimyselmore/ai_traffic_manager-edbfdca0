-- Fix RLS Policies for Supabase Security
-- This script addresses critical security issues identified in Supabase security scan

-- =====================================================
-- 1. DROP OLD POLICIES
-- =====================================================

-- Users table
DROP POLICY IF EXISTS "Users kunnen hun eigen profiel zien" ON users;
DROP POLICY IF EXISTS "Planners kunnen werknemers bewerken" ON users;
DROP POLICY IF EXISTS "Alleen planners kunnen users lezen" ON users;
DROP POLICY IF EXISTS "Alleen planners kunnen users updaten" ON users;

-- Klanten table
DROP POLICY IF EXISTS "Planners kunnen alles lezen" ON klanten;
DROP POLICY IF EXISTS "Planners kunnen alles maken" ON klanten;
DROP POLICY IF EXISTS "Alleen planners kunnen klanten lezen" ON klanten;
DROP POLICY IF EXISTS "Alleen planners kunnen klanten aanmaken" ON klanten;
DROP POLICY IF EXISTS "Alleen planners kunnen klanten updaten" ON klanten;
DROP POLICY IF EXISTS "Alleen planners kunnen klanten verwijderen" ON klanten;

-- =====================================================
-- 2. USERS TABLE - STRICT ACCESS CONTROL
-- =====================================================

-- Alleen planners kunnen users lezen
CREATE POLICY "Alleen planners kunnen users lezen"
  ON users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.is_planner = true
    )
  );

-- Alleen planners kunnen user info updaten (niet wachtwoorden!)
CREATE POLICY "Alleen planners kunnen users updaten"
  ON users FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.is_planner = true
    )
  );

-- INSERT en DELETE zijn DENY (geen policies = deny by default)
-- Users kunnen alleen worden aangemaakt via service role (admin)

-- =====================================================
-- 3. KLANTEN TABLE - PLANNER-ONLY ACCESS
-- =====================================================

CREATE POLICY "Alleen planners kunnen klanten lezen"
  ON klanten FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_planner = true
    )
  );

CREATE POLICY "Alleen planners kunnen klanten aanmaken"
  ON klanten FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_planner = true
    )
  );

CREATE POLICY "Alleen planners kunnen klanten updaten"
  ON klanten FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_planner = true
    )
  );

CREATE POLICY "Alleen planners kunnen klanten verwijderen"
  ON klanten FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_planner = true
    )
  );

-- =====================================================
-- 4. USERS TABLE - ADD GEBRUIKERSNAAM COLUMN & MIGRATE
-- =====================================================

-- Add gebruikersnaam column to users table if it doesn't exist
ALTER TABLE users
ADD COLUMN IF NOT EXISTS gebruikersnaam TEXT UNIQUE;

-- Populate gebruikersnaam from email (remove @selmore.com)
UPDATE users
SET gebruikersnaam = REPLACE(email, '@selmore.com', '')
WHERE email IS NOT NULL AND gebruikersnaam IS NULL;

-- =====================================================
-- 5. VERIFICATIE QUERY
-- =====================================================

-- Check all policies
SELECT
  schemaname,
  tablename,
  policyname,
  cmd AS operation,
  qual AS using_expression,
  with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('users', 'klanten', 'medewerkers')
ORDER BY tablename, cmd;

-- Check users gebruikersnaam values
SELECT id, naam, email, gebruikersnaam
FROM users
WHERE is_planner = true
ORDER BY naam;
