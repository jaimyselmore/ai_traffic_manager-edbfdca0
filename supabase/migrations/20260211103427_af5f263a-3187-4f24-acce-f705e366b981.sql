-- Remove kleur_hex column from disciplines
ALTER TABLE public.disciplines DROP COLUMN IF EXISTS kleur_hex;

-- Update Studio description to include editor work
UPDATE public.disciplines 
SET beschrijving = 'Productie- en ontwerpdiscipline voor grafisch ontwerp, motion graphics, video editing, montage, color grading, animatie, visuele effecten en AI-gedreven creatie'
WHERE discipline_naam = 'Studio';

-- Delete Editor discipline (now covered by Studio)
DELETE FROM public.disciplines WHERE discipline_naam = 'Editor';