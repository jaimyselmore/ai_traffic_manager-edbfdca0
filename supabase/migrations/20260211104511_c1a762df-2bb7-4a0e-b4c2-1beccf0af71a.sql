
-- Add reistijd_minuten column to klanten
ALTER TABLE public.klanten ADD COLUMN reistijd_minuten integer NULL;

-- Drop beschikbaarheid column (redundant with planning_instructies)
ALTER TABLE public.klanten DROP COLUMN IF EXISTS beschikbaarheid;

-- Drop adres column (replaced by reistijd_minuten)
ALTER TABLE public.klanten DROP COLUMN IF EXISTS adres;
