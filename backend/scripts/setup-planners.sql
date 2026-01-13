-- ============================================================
-- SETUP PLANBARE MEDEWERKERS
-- ============================================================
-- Dit script zet de juiste medewerkers als planbaar
-- en stelt de volgorde in voor de planning grid
-- ============================================================

-- Eerst: ALLE medewerkers op is_planner = false
UPDATE medewerkers SET is_planner = false;

-- Dan: Zet alleen de planbare medewerkers op true
-- Volgens de afbeelding: Jakko & Niels, Diederick & Hannah, Martijn, Daniël, Jaimy

-- Jakko & Niels (Duo team 1, volgorde 1)
UPDATE medewerkers
SET
  is_planner = true,
  planner_volgorde = 1,
  duo_team = 'team1'
WHERE naam_werknemer IN ('Jakko', 'Niels');

-- Diederick & Hannah (Duo team 2, volgorde 2)
UPDATE medewerkers
SET
  is_planner = true,
  planner_volgorde = 2,
  duo_team = 'team2'
WHERE naam_werknemer IN ('Diederick', 'Hannah');

-- Martijn (Solo, volgorde 3)
UPDATE medewerkers
SET
  is_planner = true,
  planner_volgorde = 3,
  duo_team = NULL
WHERE naam_werknemer = 'Martijn';

-- Daniël (Solo, volgorde 4)
UPDATE medewerkers
SET
  is_planner = true,
  planner_volgorde = 4,
  duo_team = NULL
WHERE naam_werknemer = 'Daniël';

-- Jaimy (Solo, volgorde 5)
UPDATE medewerkers
SET
  is_planner = true,
  planner_volgorde = 5,
  duo_team = NULL
WHERE naam_werknemer = 'Jaimy';

-- Check resultaat
SELECT
  naam_werknemer,
  is_planner,
  planner_volgorde,
  duo_team,
  beschikbaar
FROM medewerkers
ORDER BY planner_volgorde, naam_werknemer;

-- Verwacht resultaat:
-- Jakko      | true  | 1 | team1 | true
-- Niels      | true  | 1 | team1 | true
-- Diederick  | true  | 2 | team2 | true
-- Hannah     | true  | 2 | team2 | true
-- Martijn    | true  | 3 | NULL  | true
-- Daniël     | true  | 4 | NULL  | true
-- Jaimy      | true  | 5 | NULL  | true
-- Anja       | false | NULL | NULL | true  (niet planbaar, alleen meetings)
-- Ira        | false | NULL | NULL | true  (niet planbaar, alleen meetings)
-- Sarah      | false | NULL | NULL | true  (niet planbaar, alleen meetings)
