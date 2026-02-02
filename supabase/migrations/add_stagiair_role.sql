-- Add Stagiair (Intern) role to rolprofielen table
-- This role is for interns who can work across multiple disciplines

DO $$
DECLARE
  next_rol_nummer INTEGER;
BEGIN
  -- Get the next rol_nummer
  SELECT COALESCE(MAX(rol_nummer), 0) + 1 INTO next_rol_nummer FROM rolprofielen;

  -- Insert or update the Stagiair role
  INSERT INTO rolprofielen (rol_nummer, rol_naam, beschrijving_rol, taken_rol)
  VALUES (
    next_rol_nummer,
    'Stagiair',
    'Stagiaires die ondersteuning bieden aan verschillende afdelingen en multidisciplinair kunnen werken. Zij leren het vak door mee te draaien in diverse projecten en taken.',
    'Assistentie bij projecten, ondersteuning van verschillende teams (Creatie, Studio, Account, Productie), meedraaien in diverse disciplines, leerproces, praktijkervaring opdoen, specifieke taken afhankelijk van stage richting'
  )
  ON CONFLICT (rol_nummer) DO UPDATE
  SET
    rol_naam = EXCLUDED.rol_naam,
    beschrijving_rol = EXCLUDED.beschrijving_rol,
    taken_rol = EXCLUDED.taken_rol;
END $$;

-- Verify the insert
SELECT rol_nummer, rol_naam, beschrijving_rol, taken_rol
FROM rolprofielen
WHERE rol_naam = 'Stagiair';
