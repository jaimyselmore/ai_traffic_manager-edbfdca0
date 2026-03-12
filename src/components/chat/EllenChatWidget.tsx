import { useState, useRef, useEffect } from 'react';
import { X, Minus, Maximize2, Send, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { getSessionToken } from '@/lib/data/secureDataClient';
import { useAuth } from '@/contexts/AuthContext';

interface Message {
  id: string;
  role: 'user' | 'ellen';
  content: string;
}

interface EllenChatWidgetProps {
  onOpenFullChat?: () => void;
}

// ── Robot gezicht SVG ──────────────────────────────────────────────────────────
function RobotFace({ happy, size = 32 }: { happy?: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="transition-all duration-300"
    >
      {/* Antenne */}
      <line x1="32" y1="4" x2="32" y2="13" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <circle cx="32" cy="4" r="3" fill="currentColor" />

      {/* Hoofd */}
      <rect x="10" y="13" width="44" height="36" rx="10" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="2.5" />

      {/* Ogen */}
      {happy ? (
        // Blije ogen dicht (boogjes)
        <>
          <path d="M20 27 Q24 23 28 27" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <path d="M36 27 Q40 23 44 27" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        </>
      ) : (
        // Normale ogen (rondjes)
        <>
          <circle cx="24" cy="27" r="4" fill="currentColor" />
          <circle cx="40" cy="27" r="4" fill="currentColor" />
          {/* Oogschijn */}
          <circle cx="26" cy="25" r="1.5" fill="white" fillOpacity="0.6" />
          <circle cx="42" cy="25" r="1.5" fill="white" fillOpacity="0.6" />
        </>
      )}

      {/* Mond */}
      {happy ? (
        // Grote glimlach
        <path d="M20 38 Q32 50 44 38" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      ) : (
        // Kleine glimlach
        <path d="M23 38 Q32 45 41 38" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      )}

      {/* Wangetjes bloos bij blij */}
      {happy && (
        <>
          <ellipse cx="18" cy="38" rx="5" ry="3" fill="currentColor" fillOpacity="0.2" />
          <ellipse cx="46" cy="38" rx="5" ry="3" fill="currentColor" fillOpacity="0.2" />
        </>
      )}

      {/* Onderkant / kin */}
      <rect x="22" y="49" width="20" height="5" rx="2.5" fill="currentColor" fillOpacity="0.3" />
    </svg>
  );
}

// ── Bouncing dots loader ────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex gap-1 items-center px-1 py-1">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s`, animationDuration: '0.8s' }}
        />
      ))}
    </div>
  );
}

// ── Hoofd component ─────────────────────────────────────────────────────────────
export function EllenChatWidget({ onOpenFullChat }: EllenChatWidgetProps) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Persistente sessie_id voor de hele widget-sessie
  const sessieId = useRef<string>(crypto.randomUUID());

  const voornaam = user?.naam?.split(' ')[0] || '';
  const isHappy = isHovered || isLoading;

  // Welkomstbericht bij eerste open
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        id: '1',
        role: 'ellen',
        content: voornaam
          ? `Hi ${voornaam}! Wat kan ik voor je doen?`
          : 'Hi! Wat kan ik voor je doen?',
      }]);
    }
  }, [isOpen, voornaam, messages.length]);

  // Scroll naar beneden bij nieuwe berichten
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: inputValue.trim(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const sessionToken = getSessionToken();
      const { data, error } = await supabase.functions.invoke('ellen-chat', {
        body: {
          bericht: userMessage.content,       // ← was 'message', nu correct 'bericht'
          sessie_id: sessieId.current,         // ← persistent per widget-sessie
        },
        headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {},
      });

      if (error) throw error;

      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'ellen',
        content: data?.antwoord || 'Sorry, ik kon geen antwoord genereren.', // ← was 'reply'
      }]);
    } catch (err) {
      console.error('Ellen widget error:', err);
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'ellen',
        content: 'Sorry, er ging iets mis. Probeer het later opnieuw.',
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">

      {/* Chat venster */}
      {isOpen && !isMinimized && (
        <div className="mb-3 w-[360px] h-[480px] bg-card rounded-2xl shadow-2xl border border-border overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300 flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-primary/5 border-b border-border shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="text-primary">
                <RobotFace happy={isLoading} size={34} />
              </div>
              <div>
                <h3 className="font-medium text-sm text-foreground">Ellen</h3>
                <p className="text-[11px] text-muted-foreground">AI Planning Assistent</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {onOpenFullChat && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => { setIsOpen(false); onOpenFullChat(); }}
                  title="Open volledig scherm"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsMinimized(true)} title="Minimaliseren">
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsOpen(false)} title="Sluiten">
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Berichten */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-3.5 py-2 text-sm',
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-md'
                      : 'bg-muted text-foreground rounded-bl-md'
                  )}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-md px-3 py-2">
                  <TypingIndicator />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-border shrink-0">
            <form
              onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
              className="flex gap-2"
            >
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Stel een vraag..."
                className="flex-1 text-sm"
                disabled={isLoading}
                autoFocus
              />
              <Button type="submit" size="icon" disabled={!inputValue.trim() || isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Geminimaliseerde balk */}
      {isOpen && isMinimized && (
        <button
          onClick={() => setIsMinimized(false)}
          className="mb-3 flex items-center gap-2 px-4 py-2.5 bg-card rounded-full shadow-lg border border-border hover:bg-muted transition-colors animate-in slide-in-from-bottom-2 fade-in duration-200"
        >
          <div className="text-primary">
            <RobotFace size={22} />
          </div>
          <span className="text-sm font-medium text-foreground">Ellen</span>
          <X
            className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground ml-1"
            onClick={(e) => { e.stopPropagation(); setIsOpen(false); setIsMinimized(false); }}
          />
        </button>
      )}

      {/* Floating knop met robot */}
      <button
        onClick={() => { setIsOpen(!isOpen); setIsMinimized(false); }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          'group flex items-center gap-2.5 rounded-full shadow-lg transition-all duration-300',
          isOpen
            ? 'bg-muted px-4 py-2.5'
            : 'bg-primary hover:bg-primary/90 px-4 py-2.5'
        )}
      >
        <div className={cn('transition-colors', isOpen ? 'text-muted-foreground' : 'text-primary-foreground')}>
          <RobotFace happy={isHappy && !isOpen} size={28} />
        </div>
        <span className={cn(
          'text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-300',
          isOpen ? 'text-muted-foreground max-w-[80px] opacity-100' : 'text-primary-foreground',
          !isOpen && isHovered ? 'max-w-[100px] opacity-100' : !isOpen ? 'max-w-0 opacity-0' : ''
        )}>
          {isOpen ? 'Sluiten' : 'Vraag Ellen'}
        </span>
      </button>
    </div>
  );
}
