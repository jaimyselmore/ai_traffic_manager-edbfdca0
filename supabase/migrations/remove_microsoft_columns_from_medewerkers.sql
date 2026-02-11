-- Verwijder overbodige Microsoft kolommen van medewerkers tabel
-- De microsoft_tokens tabel is nu de single source of truth

-- Verwijder de kolommen (IF EXISTS voorkomt errors als ze al weg zijn)
ALTER TABLE medewerkers
DROP COLUMN IF EXISTS microsoft_connected,
DROP COLUMN IF EXISTS microsoft_connected_at,
DROP COLUMN IF EXISTS microsoft_email;

-- Klaar! Microsoft status wordt nu bepaald door de aanwezigheid van een
-- record in de microsoft_tokens tabel.
