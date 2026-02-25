-- Microsoft Invitations tabel voor email-gebaseerde calendar koppeling
-- Voer dit uit in de Supabase SQL Editor

-- 1. Maak de microsoft_invitations tabel
CREATE TABLE IF NOT EXISTS microsoft_invitations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  werknemer_id integer NOT NULL REFERENCES medewerkers(werknemer_id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  email text NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  UNIQUE(werknemer_id, token)
);

-- 2. RLS policies (alleen service_role kan lezen/schrijven)
ALTER TABLE microsoft_invitations ENABLE ROW LEVEL SECURITY;

-- 3. Index voor snelle token lookups
CREATE INDEX IF NOT EXISTS idx_microsoft_invitations_token ON microsoft_invitations(token);
CREATE INDEX IF NOT EXISTS idx_microsoft_invitations_werknemer_id ON microsoft_invitations(werknemer_id);

-- 4. Cleanup function om verlopen invitations te verwijderen (optioneel)
CREATE OR REPLACE FUNCTION cleanup_expired_invitations()
RETURNS void AS $$
BEGIN
  DELETE FROM microsoft_invitations
  WHERE expires_at < now() - interval '7 days';
END;
$$ LANGUAGE plpgsql;

-- Klaar! Nu kunnen uitnodigingen worden opgeslagen en gevalideerd.
