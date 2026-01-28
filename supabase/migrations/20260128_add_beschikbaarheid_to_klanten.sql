-- Add beschikbaarheid column to klanten table
-- This field stores when a client is available for meetings/communication

ALTER TABLE klanten
ADD COLUMN beschikbaarheid TEXT;

COMMENT ON COLUMN klanten.beschikbaarheid IS 'Beschrijft wanneer de klant beschikbaar is voor meetings en communicatie. Bijvoorbeeld: "Ma-Vr 09:00-17:00" of "Alleen dinsdagen en donderdagen"';
