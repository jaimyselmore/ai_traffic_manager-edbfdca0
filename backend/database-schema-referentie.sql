-- ============================================
-- REFERENTIEDATA TABELLEN
-- Voor data die voorheen in Google Sheets stond
-- ============================================

-- Werknemers (voorheen Google Sheet "Werknemers")
CREATE TABLE IF NOT EXISTS werknemers (
  werknemer_id INTEGER PRIMARY KEY,
  naam_werknemer TEXT NOT NULL,
  email TEXT,
  primaire_rol TEXT,
  tweede_rol TEXT,
  derde_rol TEXT,
  discipline TEXT,
  duo_team TEXT,
  is_planner BOOLEAN DEFAULT false,
  werkuren NUMERIC DEFAULT 40,
  parttime_dag TEXT,
  beschikbaar BOOLEAN DEFAULT true,
  vaardigheden TEXT,
  notities TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rolprofielen (voorheen Google Sheet "Rolprofielen")
CREATE TABLE IF NOT EXISTS rolprofielen (
  rol_nummer INTEGER PRIMARY KEY,
  rol_naam TEXT NOT NULL UNIQUE,
  beschrijving_rol TEXT,
  taken_rol TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Disciplines (voorheen Google Sheet "Discipline")
CREATE TABLE IF NOT EXISTS disciplines (
  id SERIAL PRIMARY KEY,
  discipline_naam TEXT NOT NULL UNIQUE,
  beschrijving TEXT,
  kleur_hex TEXT DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Planning Regels (voorheen Google Sheet "Regels")
CREATE TABLE IF NOT EXISTS planning_regels (
  regel_id INTEGER PRIMARY KEY,
  titel_kort TEXT NOT NULL,
  categorie TEXT,
  ernst TEXT CHECK (ernst IN ('info', 'warning', 'error')),
  voorwaarde_kort TEXT,
  actie_kort TEXT,
  max_per_dag INTEGER,
  parameters JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- RLS POLICIES voor referentiedata
-- ============================================

-- Werknemers: alleen planners kunnen lezen/schrijven
ALTER TABLE werknemers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Planners kunnen werknemers lezen"
  ON werknemers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_planner = true
    )
  );

CREATE POLICY "Planners kunnen werknemers bewerken"
  ON werknemers FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_planner = true
    )
  );

-- Rolprofielen: alleen planners kunnen lezen
ALTER TABLE rolprofielen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Planners kunnen rollen lezen"
  ON rolprofielen FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_planner = true
    )
  );

-- Disciplines: alleen planners kunnen lezen
ALTER TABLE disciplines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Planners kunnen disciplines lezen"
  ON disciplines FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_planner = true
    )
  );

-- Planning regels: alleen planners kunnen lezen
ALTER TABLE planning_regels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Planners kunnen regels lezen"
  ON planning_regels FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_planner = true
    )
  );

-- ============================================
-- INDEXES voor performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_werknemers_naam ON werknemers(naam_werknemer);
CREATE INDEX IF NOT EXISTS idx_werknemers_discipline ON werknemers(discipline);
CREATE INDEX IF NOT EXISTS idx_werknemers_beschikbaar ON werknemers(beschikbaar);
CREATE INDEX IF NOT EXISTS idx_rolprofielen_naam ON rolprofielen(rol_naam);
CREATE INDEX IF NOT EXISTS idx_disciplines_naam ON disciplines(discipline_naam);
