-- Add discipline mapping to rolprofielen table
-- This links each role to its corresponding discipline

-- Add discipline column to rolprofielen
ALTER TABLE rolprofielen
ADD COLUMN IF NOT EXISTS standaard_discipline TEXT;

COMMENT ON COLUMN rolprofielen.standaard_discipline IS 'De standaard discipline die bij deze rol hoort. Wordt automatisch toegewezen aan medewerkers met deze rol.';

-- Update existing roles with their discipline mappings
UPDATE rolprofielen SET standaard_discipline = 'Creative team' WHERE rol_naam = 'Creatie';
UPDATE rolprofielen SET standaard_discipline = 'Studio' WHERE rol_naam = 'Studio';
UPDATE rolprofielen SET standaard_discipline = 'Account' WHERE rol_naam = 'Account';
UPDATE rolprofielen SET standaard_discipline = 'Productie' WHERE rol_naam = 'Productie';
UPDATE rolprofielen SET standaard_discipline = 'Strategy' WHERE rol_naam = 'Strategy';
UPDATE rolprofielen SET standaard_discipline = NULL WHERE rol_naam = 'Stagiair'; -- Stagiair heeft geen vaste discipline

-- Add or update Editor role under Studio discipline
UPDATE rolprofielen
SET standaard_discipline = 'Studio',
    beschrijving_rol = COALESCE(beschrijving_rol, 'Video editors en monteurs die verantwoordelijk zijn voor het monteren, editen en afwerken van videoматериaal. Onderdeel van het Studio team.'),
    taken_rol = COALESCE(taken_rol, 'Video montage, editing, rough cuts maken, fine cuts, geluidsmontage, kleurcorrectie basis, export en deliverables voorbereiden, feedback verwerken van klanten')
WHERE rol_naam = 'Editor';

-- If Editor doesn't exist, insert it
DO $$
DECLARE
  next_rol_nummer INTEGER;
  editor_exists INTEGER;
BEGIN
  -- Check if Editor already exists
  SELECT COUNT(*) INTO editor_exists FROM rolprofielen WHERE rol_naam = 'Editor';

  IF editor_exists = 0 THEN
    -- Get the next rol_nummer
    SELECT COALESCE(MAX(rol_nummer), 0) + 1 INTO next_rol_nummer FROM rolprofielen;

    -- Insert Editor role
    INSERT INTO rolprofielen (rol_nummer, rol_naam, beschrijving_rol, taken_rol, standaard_discipline)
    VALUES (
      next_rol_nummer,
      'Editor',
      'Video editors en monteurs die verantwoordelijk zijn voor het monteren, editen en afwerken van videoматериал. Onderdeel van het Studio team.',
      'Video montage, editing, rough cuts maken, fine cuts, geluidsmontage, kleurcorrectie basis, export en deliverables voorbereiden, feedback verwerken van klanten',
      'Studio'
    );
  END IF;
END $$;

-- Verify the mappings
SELECT rol_nummer, rol_naam, standaard_discipline
FROM rolprofielen
ORDER BY rol_nummer;
