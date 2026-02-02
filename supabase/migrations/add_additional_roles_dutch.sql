-- Add additional roles with correct Dutch discipline mappings
-- Fixes discipline names to Dutch and adds missing roles

-- First, update existing discipline mappings to Dutch
UPDATE rolprofielen SET standaard_discipline = 'Creatie' WHERE standaard_discipline = 'Creative team';
UPDATE rolprofielen SET standaard_discipline = 'Strategie' WHERE standaard_discipline = 'Strategy';

-- Update existing role names to match new structure
UPDATE rolprofielen SET rol_naam = 'Creatief team' WHERE rol_naam = 'Creatie';
UPDATE rolprofielen SET rol_naam = 'Strategie' WHERE rol_naam = 'Strategy';

-- Add new Creatie roles
DO $$
DECLARE
  next_rol_nummer INTEGER;
BEGIN
  -- Creative Director
  SELECT COALESCE(MAX(rol_nummer), 0) + 1 INTO next_rol_nummer FROM rolprofielen;
  INSERT INTO rolprofielen (rol_nummer, rol_naam, beschrijving_rol, taken_rol, standaard_discipline)
  VALUES (
    next_rol_nummer,
    'Creative Director',
    'Creative Directors die de creatieve visie en richting bepalen voor projecten. Verantwoordelijk voor conceptontwikkeling en creatieve kwaliteit.',
    'Creatieve visie bepalen, conceptontwikkeling leiden, team aansturen, klantpresentaties, kwaliteitscontrole, briefings interpreteren',
    'Creatie'
  )
  ON CONFLICT (rol_naam) DO UPDATE
  SET standaard_discipline = EXCLUDED.standaard_discipline,
      beschrijving_rol = EXCLUDED.beschrijving_rol,
      taken_rol = EXCLUDED.taken_rol;

  -- Art Director
  SELECT COALESCE(MAX(rol_nummer), 0) + 1 INTO next_rol_nummer FROM rolprofielen;
  INSERT INTO rolprofielen (rol_nummer, rol_naam, beschrijving_rol, taken_rol, standaard_discipline)
  VALUES (
    next_rol_nummer,
    'Art Director',
    'Art Directors die verantwoordelijk zijn voor de visuele uitwerking van concepten en campagnes.',
    'Visuele concepten ontwikkelen, art direction, design supervisie, moodboards maken, fotoshoots art directen, grafische uitwerking begeleiden',
    'Creatie'
  )
  ON CONFLICT (rol_naam) DO UPDATE
  SET standaard_discipline = EXCLUDED.standaard_discipline,
      beschrijving_rol = EXCLUDED.beschrijving_rol,
      taken_rol = EXCLUDED.taken_rol;

  -- Copywriter
  SELECT COALESCE(MAX(rol_nummer), 0) + 1 INTO next_rol_nummer FROM rolprofielen;
  INSERT INTO rolprofielen (rol_nummer, rol_naam, beschrijving_rol, taken_rol, standaard_discipline)
  VALUES (
    next_rol_nummer,
    'Copywriter',
    'Copywriters die teksten schrijven voor campagnes, websites, social media en andere communicatie-uitingen.',
    'Concepten vertalen naar tekst, headlines schrijven, bodycopy, scripts, social media content, SEO teksten, tone of voice ontwikkelen',
    'Creatie'
  )
  ON CONFLICT (rol_naam) DO UPDATE
  SET standaard_discipline = EXCLUDED.standaard_discipline,
      beschrijving_rol = EXCLUDED.beschrijving_rol,
      taken_rol = EXCLUDED.taken_rol;
END $$;

-- Add Designer role to Studio
DO $$
DECLARE
  next_rol_nummer INTEGER;
BEGIN
  SELECT COALESCE(MAX(rol_nummer), 0) + 1 INTO next_rol_nummer FROM rolprofielen;
  INSERT INTO rolprofielen (rol_nummer, rol_naam, beschrijving_rol, taken_rol, standaard_discipline)
  VALUES (
    next_rol_nummer,
    'Designer',
    'Grafische designers die visuele content creëren voor diverse media en platforms.',
    'Grafisch ontwerp, layouts maken, social media graphics, branding, illustraties, digital design, print design',
    'Studio'
  )
  ON CONFLICT (rol_naam) DO UPDATE
  SET standaard_discipline = EXCLUDED.standaard_discipline,
      beschrijving_rol = EXCLUDED.beschrijving_rol,
      taken_rol = EXCLUDED.taken_rol;
END $$;

-- Verify all roles and their discipline mappings
SELECT rol_nummer, rol_naam, standaard_discipline
FROM rolprofielen
ORDER BY
  CASE standaard_discipline
    WHEN 'Creatie' THEN 1
    WHEN 'Studio' THEN 2
    WHEN 'Account' THEN 3
    WHEN 'Productie' THEN 4
    WHEN 'Strategie' THEN 5
    ELSE 6
  END,
  rol_naam;
