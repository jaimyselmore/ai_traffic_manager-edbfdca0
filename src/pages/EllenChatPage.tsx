import { useState, useEffect, useCallback, useMemo } from 'react';
import { EllenChat, ChatMessage, WijzigingsVoorstel, PlanningVoorstel } from '@/components/chat/EllenChat';
import { supabase } from '@/integrations/supabase/client';
import { getSessionToken } from '@/lib/data/secureDataClient';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

const STORAGE_KEY = 'ellen_sessie_id';

function getOrCreateSessieId(): string {
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

// Detecteer voorstel uit opgeslagen chatgeschiedenis (voor laden)
function extractVoorstelFromHistory(content: string): WijzigingsVoorstel | undefined {
  try {
    // Check voor [VOORSTEL:...] formaat in opgeslagen berichten
    const match = content.match(/\[VOORSTEL:(\{.*\})\]/);
    if (match) {
      const parsed = JSON.parse(match[1]);
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

// Verwijder voorstel-tag uit zichtbare content
function cleanContent(content: string): string {
  return content.replace(/\n*\[VOORSTEL:\{.*\}\]/g, '').trim();
}

export default function EllenChatPage() {
  const { user } = useAuth();
  const voornaam = user?.naam?.split(' ')[0] || '';

  const welcomeMessage = useMemo<ChatMessage>(() => ({
    id: '1',
    role: 'ellen',
    content: voornaam
      ? `Hi ${voornaam}, leuk dat je er bent! Wat kan ik vandaag voor je doen?`
      : 'Hey! Wat kan ik vandaag voor je doen?'
  }), [voornaam]);

  const [sessieId, setSessieId] = useState(getOrCreateSessieId);
  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage]);
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
              const voorstel = msg.rol === 'assistant' ? extractVoorstelFromHistory(msg.inhoud) : undefined;
              const content = cleanContent(msg.inhoud);
              return {
                id: `hist-${i}`,
                role: msg.rol === 'user' ? 'user' as const : 'ellen' as const,
                content: content || (voorstel?.beschrijving ?? msg.inhoud),
                voorstel,
                timestamp: new Date(msg.created_at),
              };
            }
          );
          setMessages([welcomeMessage, ...loadedMessages]);
        }
      } catch {
        // Geen geschiedenis gevonden
      } finally {
        setIsLoadingHistory(false);
      }
    }

    loadHistory();
  }, [sessieId, welcomeMessage]);

  const handleNewConversation = useCallback(() => {
    const newId = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, newId);
    setSessieId(newId);
    setMessages([welcomeMessage]);
  }, [welcomeMessage]);

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
      // Voorstel komt nu direct mee van de backend
      const voorstel: WijzigingsVoorstel | undefined = data?.voorstel?.type === 'voorstel' ? {
        tabel: data.voorstel.tabel,
        id: data.voorstel.id,
        veld: data.voorstel.veld,
        nieuwe_waarde: data.voorstel.nieuwe_waarde,
        beschrijving: data.voorstel.beschrijving,
      } : undefined;

      const planningVoorstel: PlanningVoorstel | undefined = data?.voorstel?.type === 'planning_voorstel' ? data.voorstel : undefined;

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'ellen',
        content: antwoord,
        voorstel,
        planningVoorstel,
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
      console.log('Bevestig voorstel:', voorstel);
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

      console.log('Resultaat:', { data, error });

      // Betere error handling
      let resultContent: string;
      if (error) {
        // Parse error details als beschikbaar
        const errorDetail = data?.error || data?.message || error.message || 'Onbekende fout';
        const debugInfo = data?.debug ? ` (debug: ${JSON.stringify(data.debug)})` : '';
        resultContent = `✗ ${errorDetail}${debugInfo}`;
      } else if (data?.success) {
        resultContent = `✓ ${data.message || 'Wijziging doorgevoerd!'}`;
      } else {
        resultContent = `✗ ${data?.message || 'Wijziging mislukt'}`;
      }

      const resultMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'ellen',
        content: resultContent,
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

  const handleConfirmPlanning = useCallback(async (planning: PlanningVoorstel) => {
    const sessionToken = getSessionToken();
    if (!sessionToken) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ellen-chat', {
        headers: { Authorization: `Bearer ${sessionToken}` },
        body: {
          sessie_id: sessieId,
          actie: 'plannen',
          werktype: 'concept', // Default werktype - via chat is het vaak conceptwerk
          planning,
        },
      });

      const resultContent = error
        ? `✗ ${data?.message || error.message || 'Onbekende fout'}`
        : data?.success
          ? `✓ ${data.message}`
          : `✗ ${data?.message || 'Planning mislukt'}`;

      // Verwijder planningVoorstel uit bericht
      setMessages(prev => prev.map(msg =>
        msg.planningVoorstel?.project_nummer === planning.project_nummer
          ? { ...msg, planningVoorstel: undefined }
          : msg
      ));
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'ellen',
        content: resultContent,
      }]);
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

  const handleRejectPlanning = useCallback((planning: PlanningVoorstel) => {
    setMessages(prev => prev.map(msg =>
      msg.planningVoorstel?.project_nummer === planning.project_nummer
        ? { ...msg, planningVoorstel: undefined }
        : msg
    ));
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'ellen',
      content: 'Oké, planning geannuleerd.',
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
            onConfirmPlanning={handleConfirmPlanning}
            onRejectPlanning={handleRejectPlanning}
          />
        )}
      </div>
    </div>
  );
}
