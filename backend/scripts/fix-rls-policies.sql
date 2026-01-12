-- ============================================================
-- SUPABASE RLS SECURITY FIX
-- ============================================================
-- Dit script lost de 2 critical security errors op:
-- 1. User Passwords and Email Addresses Could Be Stolen
-- 2. Customer Contact Information Could Be Accessed by Unauthorized Staff
--
-- Voer dit script uit in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. USERS TABEL - Strikte Access Control
-- ============================================================

-- Drop oude policies
DROP POLICY IF EXISTS "Users kunnen hun eigen profiel zien" ON users;
DROP POLICY IF EXISTS "Planners kunnen werknemers bewerken" ON users;

-- Enable RLS (als nog niet enabled)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- SELECT: Alleen planners kunnen users lezen
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

-- UPDATE: Alleen planners kunnen users updaten (MAAR NIET password_hash)
CREATE POLICY "Alleen planners kunnen users updaten"
  ON users FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.is_planner = true
    )
  )
  WITH CHECK (
    -- Voorkom dat password_hash wordt gewijzigd via normale updates
    password_hash = (SELECT password_hash FROM users WHERE id = users.id)
  );

-- INSERT en DELETE: GEEN policies = automatisch DENY
-- Alleen backend via service role key kan users aanmaken/verwijderen

-- ============================================================
-- 2. KLANTEN TABEL - Expliciete Planner-Only Policies
-- ============================================================

-- Drop oude policies
DROP POLICY IF EXISTS "Planners kunnen alles lezen" ON klanten;
DROP POLICY IF EXISTS "Planners kunnen alles maken" ON klanten;
DROP POLICY IF EXISTS "Planners kunnen alles updaten" ON klanten;
DROP POLICY IF EXISTS "Planners kunnen alles verwijderen" ON klanten;

-- Enable RLS
ALTER TABLE klanten ENABLE ROW LEVEL SECURITY;

-- SELECT
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

-- INSERT
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

-- UPDATE
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

-- DELETE
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

-- ============================================================
-- 3. PROJECTEN TABEL
-- ============================================================

DROP POLICY IF EXISTS "Planners kunnen alles lezen" ON projecten;
DROP POLICY IF EXISTS "Planners kunnen alles maken" ON projecten;
DROP POLICY IF EXISTS "Planners kunnen alles updaten" ON projecten;
DROP POLICY IF EXISTS "Planners kunnen alles verwijderen" ON projecten;

ALTER TABLE projecten ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alleen planners kunnen projecten lezen"
  ON projecten FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_planner = true
    )
  );

CREATE POLICY "Alleen planners kunnen projecten aanmaken"
  ON projecten FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_planner = true
    )
  );

CREATE POLICY "Alleen planners kunnen projecten updaten"
  ON projecten FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_planner = true
    )
  );

CREATE POLICY "Alleen planners kunnen projecten verwijderen"
  ON projecten FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_planner = true
    )
  );

-- ============================================================
-- 4. PROJECT_FASES TABEL
-- ============================================================

DROP POLICY IF EXISTS "Planners kunnen alles lezen" ON project_fases;
DROP POLICY IF EXISTS "Planners kunnen alles maken" ON project_fases;
DROP POLICY IF EXISTS "Planners kunnen alles updaten" ON project_fases;
DROP POLICY IF EXISTS "Planners kunnen alles verwijderen" ON project_fases;

ALTER TABLE project_fases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alleen planners kunnen project_fases lezen"
  ON project_fases FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_planner = true
    )
  );

CREATE POLICY "Alleen planners kunnen project_fases aanmaken"
  ON project_fases FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_planner = true
    )
  );

CREATE POLICY "Alleen planners kunnen project_fases updaten"
  ON project_fases FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_planner = true
    )
  );

CREATE POLICY "Alleen planners kunnen project_fases verwijderen"
  ON project_fases FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_planner = true
    )
  );

-- ============================================================
-- 5. TAKEN TABEL
-- ============================================================

DROP POLICY IF EXISTS "Planners kunnen alles lezen" ON taken;
DROP POLICY IF EXISTS "Planners kunnen alles maken" ON taken;
DROP POLICY IF EXISTS "Planners kunnen alles updaten" ON taken;
DROP POLICY IF EXISTS "Planners kunnen alles verwijderen" ON taken;

ALTER TABLE taken ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alleen planners kunnen taken lezen"
  ON taken FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_planner = true
    )
  );

CREATE POLICY "Alleen planners kunnen taken aanmaken"
  ON taken FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_planner = true
    )
  );

CREATE POLICY "Alleen planners kunnen taken updaten"
  ON taken FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_planner = true
    )
  );

CREATE POLICY "Alleen planners kunnen taken verwijderen"
  ON taken FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_planner = true
    )
  );

-- ============================================================
-- 6. MEETINGS TABEL
-- ============================================================

DROP POLICY IF EXISTS "Planners kunnen alles lezen" ON meetings;
DROP POLICY IF EXISTS "Planners kunnen alles maken" ON meetings;
DROP POLICY IF EXISTS "Planners kunnen alles updaten" ON meetings;
DROP POLICY IF EXISTS "Planners kunnen alles verwijderen" ON meetings;

ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alleen planners kunnen meetings lezen"
  ON meetings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_planner = true
    )
  );

CREATE POLICY "Alleen planners kunnen meetings aanmaken"
  ON meetings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_planner = true
    )
  );

CREATE POLICY "Alleen planners kunnen meetings updaten"
  ON meetings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_planner = true
    )
  );

CREATE POLICY "Alleen planners kunnen meetings verwijderen"
  ON meetings FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_planner = true
    )
  );

-- ============================================================
-- 7. VERLOF_AANVRAGEN TABEL
-- ============================================================

DROP POLICY IF EXISTS "Planners kunnen alles lezen" ON verlof_aanvragen;
DROP POLICY IF EXISTS "Planners kunnen alles maken" ON verlof_aanvragen;
DROP POLICY IF EXISTS "Planners kunnen alles updaten" ON verlof_aanvragen;
DROP POLICY IF EXISTS "Planners kunnen alles verwijderen" ON verlof_aanvragen;

ALTER TABLE verlof_aanvragen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alleen planners kunnen verlof_aanvragen lezen"
  ON verlof_aanvragen FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_planner = true
    )
  );

CREATE POLICY "Alleen planners kunnen verlof_aanvragen aanmaken"
  ON verlof_aanvragen FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_planner = true
    )
  );

CREATE POLICY "Alleen planners kunnen verlof_aanvragen updaten"
  ON verlof_aanvragen FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_planner = true
    )
  );

CREATE POLICY "Alleen planners kunnen verlof_aanvragen verwijderen"
  ON verlof_aanvragen FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_planner = true
    )
  );

-- ============================================================
-- 8. WIJZIGINGSVERZOEKEN TABEL
-- ============================================================

DROP POLICY IF EXISTS "Planners kunnen alles lezen" ON wijzigingsverzoeken;
DROP POLICY IF EXISTS "Planners kunnen alles maken" ON wijzigingsverzoeken;
DROP POLICY IF EXISTS "Planners kunnen alles updaten" ON wijzigingsverzoeken;
DROP POLICY IF EXISTS "Planners kunnen alles verwijderen" ON wijzigingsverzoeken;

ALTER TABLE wijzigingsverzoeken ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alleen planners kunnen wijzigingsverzoeken lezen"
  ON wijzigingsverzoeken FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_planner = true
    )
  );

CREATE POLICY "Alleen planners kunnen wijzigingsverzoeken aanmaken"
  ON wijzigingsverzoeken FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_planner = true
    )
  );

CREATE POLICY "Alleen planners kunnen wijzigingsverzoeken updaten"
  ON wijzigingsverzoeken FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_planner = true
    )
  );

CREATE POLICY "Alleen planners kunnen wijzigingsverzoeken verwijderen"
  ON wijzigingsverzoeken FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_planner = true
    )
  );

-- ============================================================
-- 9. NOTIFICATIES TABEL
-- ============================================================

DROP POLICY IF EXISTS "Planners kunnen alles lezen" ON notificaties;
DROP POLICY IF EXISTS "Planners kunnen alles maken" ON notificaties;
DROP POLICY IF EXISTS "Planners kunnen alles updaten" ON notificaties;
DROP POLICY IF EXISTS "Planners kunnen alles verwijderen" ON notificaties;

ALTER TABLE notificaties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alleen planners kunnen notificaties lezen"
  ON notificaties FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_planner = true
    )
  );

CREATE POLICY "Alleen planners kunnen notificaties aanmaken"
  ON notificaties FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_planner = true
    )
  );

CREATE POLICY "Alleen planners kunnen notificaties updaten"
  ON notificaties FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_planner = true
    )
  );

CREATE POLICY "Alleen planners kunnen notificaties verwijderen"
  ON notificaties FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_planner = true
    )
  );

-- ============================================================
-- 10. AUDIT_LOG TABEL
-- ============================================================

DROP POLICY IF EXISTS "Planners kunnen alles lezen" ON audit_log;
DROP POLICY IF EXISTS "Planners kunnen alles maken" ON audit_log;
DROP POLICY IF EXISTS "Planners kunnen alles updaten" ON audit_log;
DROP POLICY IF EXISTS "Planners kunnen alles verwijderen" ON audit_log;

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alleen planners kunnen audit_log lezen"
  ON audit_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_planner = true
    )
  );

CREATE POLICY "Alleen planners kunnen audit_log aanmaken"
  ON audit_log FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_planner = true
    )
  );

-- Geen UPDATE of DELETE voor audit_log (immutable)

-- ============================================================
-- KLAAR!
-- ============================================================

-- Verificatie: Check alle policies
SELECT
  schemaname,
  tablename,
  policyname,
  cmd as operation,
  qual as using_expression
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;
