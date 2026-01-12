-- ============================================
-- AI TRAFFIC MANAGER - DATABASE SCHEMA
-- ============================================
-- Run dit script in Supabase SQL Editor
-- Settings → Database → SQL Editor → New Query
-- ============================================

-- Enable UUID extension (voor automatische ID generatie)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABEL 1: users (Planners die kunnen inloggen)
-- ============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    naam TEXT NOT NULL,
    rol TEXT NOT NULL,
    werknemer_id INTEGER UNIQUE, -- Link naar Google Sheet werknemer
    password_hash TEXT NOT NULL,
    is_planner BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index voor snellere lookups
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_werknemer_id ON users(werknemer_id);

-- ============================================
-- TABEL 2: klanten
-- ============================================
CREATE TABLE klanten (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    klantnummer TEXT UNIQUE NOT NULL,
    naam TEXT NOT NULL,
    contactpersoon TEXT,
    email TEXT,
    telefoon TEXT,
    adres TEXT,
    notities TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_klanten_nummer ON klanten(klantnummer);

-- ============================================
-- TABEL 3: projecten
-- ============================================
CREATE TABLE projecten (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    klant_id UUID REFERENCES klanten(id) ON DELETE CASCADE,
    projectnummer TEXT UNIQUE NOT NULL,
    volgnummer INTEGER NOT NULL,
    omschrijving TEXT NOT NULL,
    projecttype TEXT NOT NULL, -- 'productie', 'guiding_idea', 'nieuw_project', 'algemeen'
    datum_aanvraag DATE NOT NULL,
    deadline DATE NOT NULL,
    status TEXT DEFAULT 'concept', -- 'concept', 'vast', 'afgerond'
    opmerkingen TEXT,
    adres_klant TEXT,
    info_klant TEXT,

    -- Team samenstelling (JSON data)
    creatie_team JSONB,  -- {enabled: true, duo: "Team 1"}
    account_team JSONB,  -- {enabled: true, verantwoordelijke: "Tom"}
    productie_team JSONB, -- {enabled: true, producer: "Sarah"}

    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(klant_id, volgnummer)
);

CREATE INDEX idx_projecten_nummer ON projecten(projectnummer);
CREATE INDEX idx_projecten_klant ON projecten(klant_id);
CREATE INDEX idx_projecten_status ON projecten(status);

-- ============================================
-- TABEL 4: project_fases (Onderdelen van projecten)
-- ============================================
CREATE TABLE project_fases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projecten(id) ON DELETE CASCADE,
    fase_naam TEXT NOT NULL, -- 'PP', 'Shoot', 'Offline edit', 'Review', etc.
    fase_type TEXT NOT NULL, -- 'fase', 'meeting', 'presentatie', 'deadline'
    medewerkers TEXT[], -- Array van werknemer namen
    inspanning_dagen DECIMAL(4,1), -- 0.5, 1, 2, 3, etc.
    start_datum DATE,
    eind_datum DATE,
    datum_tijd TIMESTAMP WITH TIME ZONE, -- Voor meetings/presentaties
    locatie TEXT, -- Voor meetings
    is_hard_lock BOOLEAN DEFAULT false, -- Meetings/deadlines zijn hard locks
    volgorde INTEGER NOT NULL, -- Volgorde binnen project
    opmerkingen TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_fases_project ON project_fases(project_id);
CREATE INDEX idx_fases_datum ON project_fases(start_datum, eind_datum);

-- ============================================
-- TABEL 5: taken (Planning items in de grid)
-- ============================================
CREATE TABLE taken (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projecten(id) ON DELETE CASCADE,
    fase_id UUID REFERENCES project_fases(id) ON DELETE SET NULL,

    -- Planning details
    werknemer_naam TEXT NOT NULL, -- Link naar Google Sheet werknemer
    klant_naam TEXT NOT NULL,
    project_nummer TEXT NOT NULL,
    fase_naam TEXT NOT NULL,
    werktype TEXT NOT NULL, -- 'Strategy', 'Creative team', 'Studio', etc.
    discipline TEXT NOT NULL, -- Voor kleurcode in UI

    -- Tijd en status
    week_start DATE NOT NULL, -- Maandag van de week (bijv. 2026-01-06)
    dag_van_week INTEGER NOT NULL, -- 0=maandag, 1=dinsdag, 2=woensdag, 3=donderdag, 4=vrijdag
    start_uur INTEGER NOT NULL, -- 9-18
    duur_uren INTEGER NOT NULL, -- Aantal uren (1-8)
    plan_status TEXT DEFAULT 'concept', -- 'concept', 'vast'

    -- Hard lock voor meetings/presentaties
    is_hard_lock BOOLEAN DEFAULT false,
    created_by UUID REFERENCES users(id), -- Wie maakte deze taak
    locked_by UUID REFERENCES users(id), -- Wie locked deze (voor hard locks)

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_taken_week ON taken(week_start);
CREATE INDEX idx_taken_werknemer ON taken(werknemer_naam);
CREATE INDEX idx_taken_project ON taken(project_id);
CREATE INDEX idx_taken_dag ON taken(dag_van_week);

-- ============================================
-- TABEL 6: meetings
-- ============================================
CREATE TABLE meetings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projecten(id) ON DELETE SET NULL,
    onderwerp TEXT NOT NULL,
    type TEXT NOT NULL, -- 'Kickoff', 'Review', 'Presentatie', 'Intern', etc.
    datum DATE NOT NULL,
    start_tijd TIME NOT NULL,
    eind_tijd TIME NOT NULL,
    locatie TEXT,
    deelnemers TEXT[], -- Array van werknemer namen
    is_hard_lock BOOLEAN DEFAULT true, -- Meetings zijn altijd hard locks
    status TEXT DEFAULT 'concept', -- 'concept', 'vast'
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_meetings_datum ON meetings(datum);
CREATE INDEX idx_meetings_project ON meetings(project_id);

-- ============================================
-- TABEL 7: verlof_aanvragen (Korte afwezigheden)
-- ============================================
CREATE TABLE verlof_aanvragen (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    werknemer_naam TEXT NOT NULL,
    type TEXT NOT NULL, -- 'Vakantie', 'Ziek', 'Training', 'Vrije dag', etc.
    start_datum DATE NOT NULL,
    eind_datum DATE NOT NULL,
    reden TEXT,
    status TEXT DEFAULT 'goedgekeurd', -- 'concept', 'goedgekeurd', 'afgewezen'
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_verlof_werknemer ON verlof_aanvragen(werknemer_naam);
CREATE INDEX idx_verlof_datum ON verlof_aanvragen(start_datum, eind_datum);

-- ============================================
-- TABEL 8: wijzigingsverzoeken
-- ============================================
CREATE TABLE wijzigingsverzoeken (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projecten(id) ON DELETE CASCADE,
    type_wijziging TEXT NOT NULL, -- 'Scope', 'Deadline', 'Team', 'Budget', etc.
    beschrijving TEXT NOT NULL,
    nieuwe_deadline DATE,
    betrokken_mensen TEXT[], -- Array van werknemer namen
    status TEXT DEFAULT 'in_behandeling', -- 'in_behandeling', 'goedgekeurd', 'afgewezen'
    impact TEXT, -- 'laag', 'medium', 'hoog'
    extra_uren INTEGER,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_wijzigingen_project ON wijzigingsverzoeken(project_id);
CREATE INDEX idx_wijzigingen_status ON wijzigingsverzoeken(status);

-- ============================================
-- TABEL 9: notificaties (Dashboard alerts)
-- ============================================
CREATE TABLE notificaties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT NOT NULL, -- 'te_laat', 'aankomende_deadline', 'review_nodig', 'wijziging', 'actief_project'
    severity TEXT NOT NULL, -- 'low', 'medium', 'high'
    titel TEXT NOT NULL,
    beschrijving TEXT,
    project_nummer TEXT,
    klant_naam TEXT,
    deadline DATE,
    aantal INTEGER, -- Aantal items in deze notificatie
    is_done BOOLEAN DEFAULT false,
    voor_werknemer TEXT, -- Specifieke werknemer (optioneel)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notificaties_type ON notificaties(type);
CREATE INDEX idx_notificaties_done ON notificaties(is_done);
CREATE INDEX idx_notificaties_werknemer ON notificaties(voor_werknemer);

-- ============================================
-- TABEL 10: audit_log (Wie deed wat wanneer)
-- ============================================
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    actie TEXT NOT NULL, -- 'created', 'updated', 'deleted'
    entiteit_type TEXT NOT NULL, -- 'project', 'taak', 'meeting', etc.
    entiteit_id UUID NOT NULL,
    oude_waarde JSONB, -- Oude data (voor updates)
    nieuwe_waarde JSONB, -- Nieuwe data
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_entiteit ON audit_log(entiteit_type, entiteit_id);
CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_timestamp ON audit_log(created_at);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================
-- Dit zorgt ervoor dat alleen planners toegang hebben

-- Enable RLS op alle tabellen
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

-- Policy: Alleen planners (is_planner=true) kunnen data lezen
CREATE POLICY "Planners kunnen alles lezen"
    ON projecten FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.is_planner = true
        )
    );

-- Policy: Alleen planners kunnen data aanmaken
CREATE POLICY "Planners kunnen alles maken"
    ON projecten FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.is_planner = true
        )
    );

-- Policy: Alleen planners kunnen data updaten
CREATE POLICY "Planners kunnen alles updaten"
    ON projecten FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.is_planner = true
        )
    );

-- Herhaal policies voor alle andere tabellen
-- (Voor nu simpele setup - in productie kun je dit verfijnen)

CREATE POLICY "Planners select klanten" ON klanten FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_planner = true));
CREATE POLICY "Planners insert klanten" ON klanten FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_planner = true));
CREATE POLICY "Planners update klanten" ON klanten FOR UPDATE USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_planner = true));
CREATE POLICY "Planners delete klanten" ON klanten FOR DELETE USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_planner = true));

CREATE POLICY "Planners select fases" ON project_fases FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_planner = true));
CREATE POLICY "Planners insert fases" ON project_fases FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_planner = true));
CREATE POLICY "Planners update fases" ON project_fases FOR UPDATE USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_planner = true));
CREATE POLICY "Planners delete fases" ON project_fases FOR DELETE USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_planner = true));

CREATE POLICY "Planners select taken" ON taken FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_planner = true));
CREATE POLICY "Planners insert taken" ON taken FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_planner = true));
CREATE POLICY "Planners update taken" ON taken FOR UPDATE USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_planner = true));
CREATE POLICY "Planners delete taken" ON taken FOR DELETE USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_planner = true));

CREATE POLICY "Planners select meetings" ON meetings FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_planner = true));
CREATE POLICY "Planners insert meetings" ON meetings FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_planner = true));
CREATE POLICY "Planners update meetings" ON meetings FOR UPDATE USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_planner = true));
CREATE POLICY "Planners delete meetings" ON meetings FOR DELETE USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_planner = true));

CREATE POLICY "Planners select verlof" ON verlof_aanvragen FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_planner = true));
CREATE POLICY "Planners insert verlof" ON verlof_aanvragen FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_planner = true));
CREATE POLICY "Planners update verlof" ON verlof_aanvragen FOR UPDATE USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_planner = true));
CREATE POLICY "Planners delete verlof" ON verlof_aanvragen FOR DELETE USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_planner = true));

CREATE POLICY "Planners select wijzigingen" ON wijzigingsverzoeken FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_planner = true));
CREATE POLICY "Planners insert wijzigingen" ON wijzigingsverzoeken FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_planner = true));
CREATE POLICY "Planners update wijzigingen" ON wijzigingsverzoeken FOR UPDATE USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_planner = true));
CREATE POLICY "Planners delete wijzigingen" ON wijzigingsverzoeken FOR DELETE USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_planner = true));

CREATE POLICY "Planners select notificaties" ON notificaties FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_planner = true));
CREATE POLICY "Planners insert notificaties" ON notificaties FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_planner = true));
CREATE POLICY "Planners update notificaties" ON notificaties FOR UPDATE USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_planner = true));
CREATE POLICY "Planners delete notificaties" ON notificaties FOR DELETE USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_planner = true));

CREATE POLICY "Planners select audit" ON audit_log FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_planner = true));
CREATE POLICY "Planners insert audit" ON audit_log FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_planner = true));

-- Users tabel: gebruikers kunnen hun eigen profiel zien
CREATE POLICY "Users kunnen eigen profiel zien"
    ON users FOR SELECT
    USING (auth.uid() = id);

-- ============================================
-- KLAAR!
-- ============================================
-- Nu heb je alle tabellen en security policies aangemaakt
-- Je kunt de data bekijken via: Supabase Dashboard → Table Editor
