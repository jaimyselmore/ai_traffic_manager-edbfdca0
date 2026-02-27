import { useState, useEffect, useRef, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface WijzigingsVoorstel {
  tabel: string;
  id: string;
  veld: string;
  nieuwe_waarde: string;
  beschrijving: string;
}

export interface PlanningVoorstel {
  type: 'planning_voorstel';
  klant_naam: string;
  project_nummer: string;
  project_omschrijving?: string;
  aantal_taken: number;
  taken: Array<{
    werknemer_naam: string;
    fase_naam: string;
    discipline: string;
    werktype: string;
    week_start: string;
    dag_van_week: number;
    start_uur: number;
    duur_uren: number;
  }>;
  samenvatting: string;
}

export interface ChatMessage {
  id: string;
  role: 'ellen' | 'user';
  content: string;
  voorstel?: WijzigingsVoorstel;
  planningVoorstel?: PlanningVoorstel;
  timestamp?: Date;
}

interface EllenChatProps {
  contextSummary?: ReactNode;
  extraActions?: ReactNode;
  initialMessages?: ChatMessage[];
  isLoading?: boolean;
  onSendMessage?: (message: string) => void;
  onConfirmProposal?: (voorstel: WijzigingsVoorstel) => void;
  onRejectProposal?: (voorstel: WijzigingsVoorstel) => void;
  onConfirmPlanning?: (planning: PlanningVoorstel) => void;
  onRejectPlanning?: (planning: PlanningVoorstel) => void;
  showInput?: boolean;
}

export function EllenChat({
  contextSummary,
  extraActions,
  initialMessages = [],
  isLoading = false,
  onSendMessage,
  onConfirmProposal,
  onRejectProposal,
  onConfirmPlanning,
  onRejectPlanning,
  showInput = true
}: EllenChatProps) {
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;
    if (onSendMessage) {
      onSendMessage(inputValue);
    }
    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <section className="flex flex-col h-full min-h-[60vh] max-h-[75vh] bg-card rounded-2xl border border-border shadow-sm">
      {contextSummary && (
        <div className="border-b border-border p-4">
          {contextSummary}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/30">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex items-start gap-2 ${message.role === 'user' ? 'justify-end' : ''}`}
          >
            {message.role === 'ellen' && (
              <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-[10px] font-semibold shrink-0">
                E
              </div>
            )}
            <div className="flex flex-col gap-2 max-w-[75%]">
              <div
                className={`rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap shadow-sm ${
                  message.role === 'ellen'
                    ? 'bg-card border border-border text-foreground'
                    : 'bg-primary text-primary-foreground'
                }`}
              >
                {message.content}
              </div>

              {/* Wijzigingsvoorstel met bevestig-knoppen */}
              {message.voorstel && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-sm">
                  <div className="font-medium text-amber-800 dark:text-amber-200 mb-2">
                    Wijzigingsvoorstel
                  </div>
                  <div className="text-amber-700 dark:text-amber-300 mb-3">
                    {message.voorstel.beschrijving}
                  </div>
                  <div className="text-xs text-amber-600 dark:text-amber-400 mb-3">
                    <span className="font-mono">{message.voorstel.tabel}.{message.voorstel.veld}</span> → <span className="font-medium">{message.voorstel.nieuwe_waarde}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => onConfirmProposal?.(message.voorstel!)}
                    >
                      Bevestigen
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onRejectProposal?.(message.voorstel!)}
                    >
                      Annuleren
                    </Button>
                  </div>
                </div>
              )}

              {/* Planningsvoorstel met bevestig-knoppen */}
              {message.planningVoorstel && (
                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-3 text-sm">
                  <div className="font-medium text-blue-800 dark:text-blue-200 mb-2">
                    📅 Planningsvoorstel — {message.planningVoorstel.klant_naam}
                  </div>
                  <div className="text-blue-700 dark:text-blue-300 mb-2 text-xs">
                    Project: {message.planningVoorstel.project_nummer}
                    {message.planningVoorstel.project_omschrijving && ` — ${message.planningVoorstel.project_omschrijving}`}
                  </div>
                  <div className="text-xs text-blue-600 dark:text-blue-400 mb-3 whitespace-pre-wrap font-mono">
                    {message.planningVoorstel.samenvatting}
                  </div>
                  <div className="text-xs text-blue-500 dark:text-blue-400 mb-3">
                    {message.planningVoorstel.aantal_taken} taken als concept
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => onConfirmPlanning?.(message.planningVoorstel!)}
                    >
                      Inplannen
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onRejectPlanning?.(message.planningVoorstel!)}
                    >
                      Annuleren
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-start gap-2">
            <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-[10px] font-semibold">
              E
            </div>
            <div className="bg-card border border-border rounded-2xl px-3 py-2 text-sm text-muted-foreground shadow-sm">
              <span className="inline-flex gap-1">
                <span className="animate-bounce">.</span>
                <span className="animate-bounce" style={{ animationDelay: '0.1s' }}>.</span>
                <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>.</span>
              </span>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {showInput && (
        <div className="border-t border-border bg-card p-3 space-y-3 rounded-b-2xl">
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="Stel een vraag aan Ellen..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 rounded-full text-sm h-9"
            />
            <Button size="sm" onClick={handleSendMessage} className="h-9">
              Stuur
            </Button>
          </div>
          {extraActions && (
            <div className="w-full">
              {extraActions}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
