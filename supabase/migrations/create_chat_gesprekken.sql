-- Migration: Maak chat_gesprekken tabel aan voor Ellen AI chatgeschiedenis
-- Reden: Ellen heeft een tabel nodig om gesprekken op te slaan voor context/geheugen

CREATE TABLE chat_gesprekken (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sessie_id TEXT NOT NULL,
    rol TEXT NOT NULL CHECK (rol IN ('user', 'assistant')),
    inhoud TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexen voor snelle lookups
CREATE INDEX idx_chat_sessie ON chat_gesprekken(sessie_id);
CREATE INDEX idx_chat_created ON chat_gesprekken(created_at);

-- RLS inschakelen (edge function gebruikt service_role key en bypassed RLS)
ALTER TABLE chat_gesprekken ENABLE ROW LEVEL SECURITY;

-- Comments
COMMENT ON TABLE chat_gesprekken IS 'Chat gesprekken met Ellen AI assistent';
COMMENT ON COLUMN chat_gesprekken.sessie_id IS 'Unieke sessie ID per gesprek';
COMMENT ON COLUMN chat_gesprekken.rol IS 'Wie het bericht stuurde: user of assistant';
COMMENT ON COLUMN chat_gesprekken.inhoud IS 'De inhoud van het chatbericht';
