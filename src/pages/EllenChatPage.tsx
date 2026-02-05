import { useState, useEffect, useCallback } from 'react';
import { EllenChat, ChatMessage, WijzigingsVoorstel } from '@/components/chat/EllenChat';
import { supabase } from '@/integrations/supabase/client';
import { getSessionToken } from '@/lib/data/secureDataClient';
import { Button } from '@/components/ui/button';

const STORAGE_KEY = 'ellen_sessie_id';

const WELCOME_MESSAGE: ChatMessage = {
  id: '1',
  role: 'ellen',
  content: 'Hoi! Ik ben Ellen, je AI-assistent voor planning. Stel gerust een vraag over projecten, medewerkers, capaciteit, deadlines of teamverdeling. Ik zoek het voor je op!'
};

function getOrCreateSessieId(): string {
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

// Detecteer voorstel in Ellen's antwoord
function extractVoorstel(content: string): WijzigingsVoorstel | undefined {
  // Ellen's antwoord kan een JSON voorstel-object bevatten in de tool output
  try {
    const match = content.match(/\{[\s\S]*"type":\s*"voorstel"[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (parsed.type === 'voorstel' && parsed.tabel && parsed.id && parsed.veld) {
        return {
          tabel: parsed.tabel,
          id: parsed.id,
          veld: parsed.veld,
          nieuwe_waarde: parsed.nieuwe_waarde,
          beschrijving: parsed.beschrijving || `${parsed.veld} aanpassen naar "${parsed.nieuwe_waarde}"`,
        };
      }
    }
  } catch {
    // Geen geldig voorstel
  }
  return undefined;
}

export default function EllenChatPage() {
  const [sessieId, setSessieId] = useState(getOrCreateSessieId);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  // Laad vorige berichten bij mount
  useEffect(() => {
    async function loadHistory() {
      const sessionToken = getSessionToken();
      if (!sessionToken) {
        setIsLoadingHistory(false);
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke('ellen-chat', {
          headers: { Authorization: `Bearer ${sessionToken}` },
          body: { sessie_id: sessieId, actie: 'laden' },
        });

        if (!error && data?.berichten?.length > 0) {
          const loadedMessages: ChatMessage[] = data.berichten.map(
            (msg: { rol: string; inhoud: string; created_at: string }, i: number) => {
              const voorstel = msg.rol === 'assistant' ? extractVoorstel(msg.inhoud) : undefined;
              // Verwijder JSON uit zichtbare content als er een voorstel is
              let content = msg.inhoud;
              if (voorstel) {
                content = content.replace(/\{[\s\S]*"type":\s*"voorstel"[\s\S]*\}/, '').trim();
                if (!content) content = voorstel.beschrijving;
              }
              return {
                id: `hist-${i}`,
                role: msg.rol === 'user' ? 'user' as const : 'ellen' as const,
                content,
                voorstel,
                timestamp: new Date(msg.created_at),
              };
            }
          );
          setMessages([WELCOME_MESSAGE, ...loadedMessages]);
        }
      } catch {
        // Geen geschiedenis gevonden
      } finally {
        setIsLoadingHistory(false);
      }
    }

    loadHistory();
  }, [sessieId]);

  const handleNewConversation = useCallback(() => {
    const newId = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, newId);
    setSessieId(newId);
    setMessages([WELCOME_MESSAGE]);
  }, []);

  const handleSendMessage = useCallback(async (message: string) => {
    const sessionToken = getSessionToken();

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
    };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      if (!sessionToken) {
        throw new Error('Je bent niet ingelogd. Log eerst in.');
      }

      const { data, error } = await supabase.functions.invoke('ellen-chat', {
        headers: { Authorization: `Bearer ${sessionToken}` },
        body: { sessie_id: sessieId, bericht: message },
      });

      if (error) throw new Error(error.message || 'Fout bij communicatie met Ellen');

      const antwoord = data?.antwoord || 'Sorry, ik kon geen antwoord genereren. Probeer het opnieuw.';
      const voorstel = extractVoorstel(antwoord);

      // Verwijder JSON uit zichtbare content
      let cleanContent = antwoord;
      if (voorstel) {
        cleanContent = antwoord.replace(/\{[\s\S]*"type":\s*"voorstel"[\s\S]*\}/, '').trim();
        if (!cleanContent) cleanContent = voorstel.beschrijving;
      }

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'ellen',
        content: cleanContent,
        voorstel,
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'ellen',
        content: `Sorry, er ging iets mis: ${err instanceof Error ? err.message : 'Onbekende fout'}`,
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [sessieId]);

  const handleConfirmProposal = useCallback(async (voorstel: WijzigingsVoorstel) => {
    const sessionToken = getSessionToken();
    if (!sessionToken) return;

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('ellen-chat', {
        headers: { Authorization: `Bearer ${sessionToken}` },
        body: {
          sessie_id: sessieId,
          actie: 'uitvoeren',
          tabel: voorstel.tabel,
          id: voorstel.id,
          veld: voorstel.veld,
          nieuwe_waarde: voorstel.nieuwe_waarde,
        },
      });

      const resultMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'ellen',
        content: data?.success
          ? `✓ ${data.message || 'Wijziging doorgevoerd!'}`
          : `✗ ${data?.message || error?.message || 'Wijziging mislukt'}`,
      };

      // Verwijder voorstel uit het oorspronkelijke bericht
      setMessages(prev => prev.map(msg =>
        msg.voorstel?.id === voorstel.id && msg.voorstel?.veld === voorstel.veld
          ? { ...msg, voorstel: undefined }
          : msg
      ));
      setMessages(prev => [...prev, resultMessage]);
    } catch (err) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'ellen',
        content: `✗ Fout: ${err instanceof Error ? err.message : 'Onbekende fout'}`,
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [sessieId]);

  const handleRejectProposal = useCallback((voorstel: WijzigingsVoorstel) => {
    // Verwijder voorstel uit het bericht
    setMessages(prev => prev.map(msg =>
      msg.voorstel?.id === voorstel.id && msg.voorstel?.veld === voorstel.veld
        ? { ...msg, voorstel: undefined }
        : msg
    ));
    // Voeg annuleer-bericht toe
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'ellen',
      content: 'Oké, wijziging geannuleerd.',
    }]);
  }, []);

  return (
    <div className="h-full flex flex-col space-y-8">
      <div className="px-6 pt-0 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ellen</h1>
          <p className="mt-1 text-base text-muted-foreground">
            Stel je vraag over de planning, projecten of capaciteit
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleNewConversation}>
          Nieuw gesprek
        </Button>
      </div>

      <div className="flex-1 px-6 pb-6">
        {isLoadingHistory ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Gesprek laden...
          </div>
        ) : (
          <EllenChat
            initialMessages={messages}
            isLoading={isLoading}
            onSendMessage={handleSendMessage}
            onConfirmProposal={handleConfirmProposal}
            onRejectProposal={handleRejectProposal}
          />
        )}
      </div>
    </div>
  );
}
