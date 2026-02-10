-- Maak een admin rol aan door de rol kolom bij te werken
-- Voer dit uit in de Supabase SQL Editor

-- BELANGRIJK: Vervang 'jouw_gebruikersnaam' met je eigen gebruikersnaam
-- Dit geeft die gebruiker admin rechten

-- Voorbeeld: als je gebruikersnaam 'jaimy' is:
UPDATE users
SET rol = 'admin'
WHERE gebruikersnaam = 'jaimy';

-- Om te controleren welke users admin zijn:
-- SELECT gebruikersnaam, naam, rol FROM users WHERE rol = 'admin';
