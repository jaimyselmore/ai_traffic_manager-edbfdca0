-- Ellen Planning Regels
-- Voer dit uit in Supabase SQL Editor

-- Drop en maak tabel opnieuw (past bij edge function structuur)
DROP TABLE IF EXISTS ellen_regels;

CREATE TABLE ellen_regels (
  id SERIAL PRIMARY KEY,
  categorie TEXT NOT NULL CHECK (categorie IN ('hard', 'soft', 'voorkeur')),
  prioriteit INTEGER NOT NULL DEFAULT 1,
  regel TEXT NOT NULL,
  rationale TEXT,
  actief BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE ellen_regels ENABLE ROW LEVEL SECURITY;

-- Allow read access for authenticated users
CREATE POLICY "Allow read access" ON ellen_regels
  FOR SELECT TO authenticated USING (true);

-- ============================================
-- HARDE REGELS (nooit overtreden)
-- categorie = 'hard'
-- ============================================

INSERT INTO ellen_regels (categorie, prioriteit, regel, rationale) VALUES
('hard', 1, 'Werk alleen inplannen tussen 09:00-17:30, maandag t/m vrijdag', 'Werktijden respecteren'),
('hard', 2, 'Maximaal 1 klantpresentatie per dag per persoon', 'Presentaties kosten veel energie'),
('hard', 3, 'Plan automatisch 30 min reistijd voor en na externe meetings', 'Reistijd nodig'),
('hard', 4, 'Items met status goedgekeurd of vast niet verschuiven zonder toestemming', 'Goedgekeurde planning respecteren'),
('hard', 5, 'Nooit inplannen op vrije dag of tijdens verlof', 'Beschikbaarheid checken');

-- ============================================
-- SOFT REGELS (belangrijk, maar mag afwijken met uitleg)
-- categorie = 'soft'
-- ============================================

INSERT INTO ellen_regels (categorie, prioriteit, regel, rationale) VALUES
('soft', 10, 'Houd 20% van de dag vrij (max 80% bezetting)', 'Buffer voor onverwachte zaken'),
('soft', 11, 'Feedback geven voor weekend/afwezigheid zodat ontvanger kan doorwerken', 'Feedback timing'),
('soft', 12, 'Minimaal 30 min buffer tussen verschillende projecten', 'Context-switch tijd'),
('soft', 13, 'Altijd tijd tussen interne review en presentatie aan klant', 'Feedback verwerken'),
('soft', 14, 'Bij schuiven: totaal uren per project en persoon blijft gelijk', 'Uren behouden'),
('soft', 15, 'Max 2 projecten per dag (korte feedback < 30 min telt niet)', 'Focus behouden'),
('soft', 16, 'Creatief/productie werk: min 2 uur aaneengesloten', 'Minimale blokgrootte'),
('soft', 17, 'Na 14:00 vrijdag geen grote nieuwe taken starten', 'Weekend respecteren'),
('soft', 18, 'Plan presentaties terug vanaf deadline', 'Deadline-gedreven plannen'),
('soft', 19, 'Min 2 werkdagen tussen presentatie en verwachte klant feedback', 'Klant reactietijd'),
('soft', 20, 'Nooit presentatie direct na laatste werkdag - tijd voor finaliseren', 'Verwerktijd'),
('soft', 21, 'Als medewerker vol: meld direct en bied alternatieven aan', 'Transparant over capaciteit'),
('soft', 22, 'Als planning niet past: meld METEEN en geef alternatieven', 'Proactief communiceren');

-- ============================================
-- VOORKEUREN (volg waar mogelijk)
-- categorie = 'voorkeur'
-- ============================================

INSERT INTO ellen_regels (categorie, prioriteit, regel, rationale) VALUES
('voorkeur', 30, 'Plan eerst leidende rollen (CD, AD, Strategy), dan uitvoering', 'Feedback beschikbaar wanneer werk klaar'),
('voorkeur', 31, 'Reviews vroeg op de dag - ontvanger kan zelfde dag aanpassen', 'Feedback ochtend'),
('voorkeur', 32, 'Conceptontwikkeling niet korter dan 2 uur plannen', 'Creatief werk ademruimte'),
('voorkeur', 33, 'Lunchmeetings alleen bij kennismaking of strategische meetings', 'Lunch vrijhouden'),
('voorkeur', 34, 'Vrijdag = afronden en voorbereiden, niet starten', 'Week afsluiten'),
('voorkeur', 35, 'Focuswerk in ochtend, klein werk/feedback in middag', 'Energie verdeling'),
('voorkeur', 36, 'Bij schuiven: binnen zelfde week blijven', 'Ritme behouden'),
('voorkeur', 37, 'Bij conflicten: 1. Deadline eerst, 2. Klant boven intern, 3. Groot boven klein', 'Prioritering'),
('voorkeur', 38, 'Eerste presentatie na ~30% doorlooptijd', 'Vroeg koers corrigeren'),
('voorkeur', 39, 'Kick-off: Account + Producer + Creative lead', 'Juiste mensen bij meetings'),
('voorkeur', 40, 'Altijd interne check voor werk naar klant gaat', 'Kwaliteit waarborgen'),
('voorkeur', 41, 'Check planning_instructies van klant', 'Klant voorkeuren'),
('voorkeur', 42, 'Studio pas na concept goedkeuring', 'Afhankelijkheden respecteren');

-- ============================================
-- VERBODEN ACTIES (nooit doen - ook als soft met hoge prioriteit)
-- ============================================

INSERT INTO ellen_regels (categorie, prioriteit, regel, rationale) VALUES
('soft', 5, 'NOOIT presentatie inplannen op dag dat werk nog gepland staat', 'Werk eerst af'),
('soft', 6, 'ALTIJD waarschuwen als planning krappe marges heeft', 'Transparantie'),
('soft', 7, 'NOOIT klantmeetings plannen zonder te vermelden dat beschikbaarheid bevestigd moet worden', 'Klant beschikbaarheid'),
('soft', 8, 'ALTIJD checken of account manager erbij is, creative lead bij eindpresentaties', 'Juiste mensen'),
('soft', 9, 'Niet meer meetings voorstellen dan nodig voor projecttype', 'Meetings kosten werktijd');
