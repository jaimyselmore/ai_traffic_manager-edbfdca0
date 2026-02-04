-- Migration: Splits 'notities' kolom in 'interne_notities' en 'planning_instructies'
-- Reden: 'notities' is te vaag. Twee aparte velden zorgen ervoor dat:
--   1. Interne notities (vrij tekstveld) gescheiden zijn van planning-specifieke info
--   2. Ellen (AI agent) gericht het planning_instructies veld kan raadplegen

-- Stap 1: Hernoem bestaande 'notities' naar 'interne_notities'
ALTER TABLE klanten
RENAME COLUMN notities TO interne_notities;

-- Stap 2: Voeg 'planning_instructies' kolom toe
ALTER TABLE klanten
ADD COLUMN IF NOT EXISTS planning_instructies text;

-- Comments voor documentatie
COMMENT ON COLUMN klanten.interne_notities IS 'Vrij tekstveld voor algemene opmerkingen over de klant';
COMMENT ON COLUMN klanten.planning_instructies IS 'Specifieke instructies voor Ellen/planning, bijv. "Klant wil alleen ochtend vergaderen", "Altijd Jan erbij betrekken"';

-- Stap 3: Beschikbaarheid kolom toevoegen (als die er nog niet is)
ALTER TABLE klanten
ADD COLUMN IF NOT EXISTS beschikbaarheid text;

COMMENT ON COLUMN klanten.beschikbaarheid IS 'Wanneer de klant beschikbaar is, bijv. "Ma-Vr 9:00-17:00"';
