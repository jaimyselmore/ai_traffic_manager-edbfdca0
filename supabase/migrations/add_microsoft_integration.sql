-- Microsoft Integratie Database Setup
-- Voer dit uit in de Supabase SQL Editor

-- 1. Voeg Microsoft kolommen toe aan medewerkers tabel
ALTER TABLE medewerkers
ADD COLUMN IF NOT EXISTS microsoft_connected boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS microsoft_connected_at timestamptz,
ADD COLUMN IF NOT EXISTS microsoft_email text;

-- 2. Maak de microsoft_tokens tabel voor OAuth tokens
CREATE TABLE IF NOT EXISTS microsoft_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  werknemer_id integer NOT NULL REFERENCES medewerkers(werknemer_id) ON DELETE CASCADE,
  access_token_encrypted text NOT NULL,
  refresh_token_encrypted text,
  token_expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(werknemer_id)
);

-- 3. RLS policies voor microsoft_tokens (alleen service_role kan lezen/schrijven)
ALTER TABLE microsoft_tokens ENABLE ROW LEVEL SECURITY;

-- Geen policies = alleen service_role heeft toegang (veiligste optie)
-- De Edge Functions gebruiken de service_role key

-- 4. Index voor snelle lookups
CREATE INDEX IF NOT EXISTS idx_microsoft_tokens_werknemer_id ON microsoft_tokens(werknemer_id);

-- Klaar! De Edge Functions kunnen nu tokens opslaan en ophalen.
