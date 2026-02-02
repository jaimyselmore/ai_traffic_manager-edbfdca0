-- Check alle rollen met beschrijvingen
SELECT
  rol_nummer,
  rol_naam,
  beschrijving_rol,
  taken_rol
FROM rolprofielen
ORDER BY rol_nummer;

-- Check alle disciplines met beschrijvingen
SELECT
  id,
  discipline_naam,
  beschrijving,
  kleur_hex
FROM disciplines
ORDER BY id;

-- Check voorbeelden van medewerkers met hun rollen en disciplines
SELECT
  werknemer_id,
  naam_werknemer,
  primaire_rol,
  tweede_rol,
  derde_rol,
  discipline,
  display_order
FROM medewerkers
ORDER BY display_order
LIMIT 10;
