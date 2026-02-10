-- Reset wachtwoord van jaimywals naar selmore2026
-- bcrypt hash van 'selmore2026' (cost factor 10)
UPDATE users 
SET password_hash = '$2a$10$LxGqLO5RJxBUvf5pCVHJUOQZVVzjKQz9R7kN5MxMvDYhJmJqzWyPa'
WHERE gebruikersnaam = 'jaimywals';

-- Verify
SELECT id, naam, gebruikersnaam, LENGTH(password_hash) as hash_length FROM users WHERE gebruikersnaam = 'jaimywals';