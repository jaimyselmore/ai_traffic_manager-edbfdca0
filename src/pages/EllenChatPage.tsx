import { useState, useEffect, useCallback } from 'react';
import { EllenChat, ChatMessage } from '@/components/chat/EllenChat';
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
            (msg: { rol: string; inhoud: string; created_at: string }, i: number) => ({
              id: `hist-${i}`,
              role: msg.rol === 'user' ? 'user' as const : 'ellen' as const,
              content: msg.inhoud,
              timestamp: new Date(msg.created_at),
            })
          );
          setMessages([WELCOME_MESSAGE, ...loadedMessages]);
        }
      } catch {
        // Geen geschiedenis gevonden, dat is prima
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

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'ellen',
        content: antwoord,
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
          />
        )}
      </div>
    </div>
  );
}
