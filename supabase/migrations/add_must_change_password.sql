-- Voeg must_change_password kolom toe aan users tabel
-- Dit forceert gebruikers om hun wachtwoord te wijzigen bij eerste login

ALTER TABLE users
ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;

-- Zet bestaande users op false (ze hoeven niet te wijzigen)
UPDATE users SET must_change_password = false WHERE must_change_password IS NULL;

-- Maak de kolom NOT NULL na het updaten
ALTER TABLE users
ALTER COLUMN must_change_password SET NOT NULL;

COMMENT ON COLUMN users.must_change_password IS 'Indien true, moet gebruiker wachtwoord wijzigen bij volgende login';
