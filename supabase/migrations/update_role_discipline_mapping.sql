-- Update existing roles with correct discipline mappings
-- First DELETE newly added duplicate roles, then map existing ones

-- Delete the newly added roles (Creative Director, Art Director, Copywriter, Designer)
-- These are duplicates of existing roles with different names
DELETE FROM rolprofielen
WHERE rol_naam IN ('Creative Director', 'Art Director', 'Copywriter', 'Designer')
AND rol_nummer > 10; -- Only delete if they were added recently (high rol_nummer)

-- Now map existing roles to correct disciplines using pattern matching
-- Role names stay as-is to avoid conflicts

-- Map Creative-related roles to Creatie discipline
-- Keep existing role names as-is, only update discipline
UPDATE rolprofielen
SET standaard_discipline = 'Creatie'
WHERE (
  LOWER(rol_naam) LIKE '%creative%'
  OR LOWER(rol_naam) LIKE '%creatief%'
  OR LOWER(rol_naam) LIKE '%art%'
  OR LOWER(rol_naam) LIKE '%copy%'
  OR LOWER(rol_naam) LIKE '%text%'
  OR LOWER(rol_naam) LIKE '%tekst%'
  OR LOWER(rol_naam) LIKE '%concept%'
)
AND rol_naam != 'Stagiair'
AND LOWER(rol_naam) NOT LIKE '%account%'
AND LOWER(rol_naam) NOT LIKE '%production%'
AND LOWER(rol_naam) NOT LIKE '%productie%';

-- Map Studio-related roles to Studio discipline
-- Keep existing role names as-is, only update discipline
UPDATE rolprofielen
SET standaard_discipline = 'Studio'
WHERE (
  LOWER(rol_naam) LIKE '%studio%'
  OR LOWER(rol_naam) LIKE '%editor%'
  OR LOWER(rol_naam) LIKE '%montage%'
  OR LOWER(rol_naam) LIKE '%monteur%'
  OR LOWER(rol_naam) LIKE '%design%'
  OR LOWER(rol_naam) LIKE '%ontwerp%'
  OR LOWER(rol_naam) LIKE '%grafisch%'
  OR LOWER(rol_naam) LIKE '%video%'
  OR LOWER(rol_naam) LIKE '%motion%'
  OR LOWER(rol_naam) LIKE '%post%'
)
AND rol_naam != 'Stagiair';

-- Map Account role to Account discipline
-- Keep existing role names as-is, only update discipline
UPDATE rolprofielen
SET standaard_discipline = 'Account'
WHERE (
  LOWER(rol_naam) LIKE '%account%'
  OR LOWER(rol_naam) LIKE '%klant%'
  OR LOWER(rol_naam) LIKE '%client%'
)
AND rol_naam != 'Stagiair';

-- Map Productie role to Productie discipline
-- Keep existing role names as-is, only update discipline
UPDATE rolprofielen
SET standaard_discipline = 'Productie'
WHERE (
  LOWER(rol_naam) LIKE '%productie%'
  OR LOWER(rol_naam) LIKE '%production%'
  OR LOWER(rol_naam) LIKE '%producer%'
)
AND rol_naam != 'Stagiair';

-- Map Strategie role to Strategie discipline
-- Keep existing role names as-is, only update discipline
UPDATE rolprofielen
SET standaard_discipline = 'Strategie'
WHERE (
  LOWER(rol_naam) LIKE '%strategie%'
  OR LOWER(rol_naam) LIKE '%strategy%'
  OR LOWER(rol_naam) LIKE '%strateeg%'
  OR LOWER(rol_naam) LIKE '%strategist%'
  OR LOWER(rol_naam) LIKE '%planning%'
)
AND rol_naam != 'Stagiair';

-- Stagiair has no fixed discipline
UPDATE rolprofielen
SET standaard_discipline = NULL
WHERE rol_naam = 'Stagiair';

-- Show all roles with their disciplines
SELECT
  rol_nummer,
  rol_naam,
  standaard_discipline,
  LEFT(beschrijving_rol, 50) as beschrijving_kort
FROM rolprofielen
ORDER BY
  CASE standaard_discipline
    WHEN 'Creatie' THEN 1
    WHEN 'Studio' THEN 2
    WHEN 'Account' THEN 3
    WHEN 'Productie' THEN 4
    WHEN 'Strategie' THEN 5
    WHEN NULL THEN 6
    ELSE 7
  END,
  rol_naam;

-- Show roles without discipline (excluding Stagiair)
SELECT
  rol_nummer,
  rol_naam,
  'NIET GEKOPPELD!' as status
FROM rolprofielen
WHERE standaard_discipline IS NULL
AND rol_naam != 'Stagiair';
