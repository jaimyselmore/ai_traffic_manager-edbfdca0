-- ============================================================
-- VOEG 'in_planning' KOLOM TOE
-- ============================================================
-- in_planning = moet deze medewerker IN de planning grid staan?
-- is_planner = is deze medewerker een planner (mag planning maken)?
-- ============================================================

-- Voeg kolom toe
ALTER TABLE medewerkers
ADD COLUMN IF NOT EXISTS in_planning BOOLEAN DEFAULT false;

-- Zet alle planbare medewerkers op in_planning = true
-- Volgens de afbeelding: Jakko & Niels, Diederick & Hannah, Martijn, Daniël, Jaimy

UPDATE medewerkers
SET in_planning = true
WHERE naam_werknemer IN ('Jakko', 'Niels', 'Diederick', 'Hannah', 'Martijn', 'Daniël', 'Jaimy');

-- Rest blijft false (Anja, Ira, Sarah)
UPDATE medewerkers
SET in_planning = false
WHERE naam_werknemer NOT IN ('Jakko', 'Niels', 'Diederick', 'Hannah', 'Martijn', 'Daniël', 'Jaimy');

-- Check resultaat
SELECT
  naam_werknemer,
  in_planning,
  is_planner,
  planner_volgorde,
  duo_team
FROM medewerkers
WHERE beschikbaar = true
ORDER BY in_planning DESC, planner_volgorde, naam_werknemer;
