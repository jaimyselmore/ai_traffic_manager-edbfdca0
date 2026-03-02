import { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Minus, Maximize2, Send, Loader2 } from 'lucide-react';
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

export function EllenChatWidget({ onOpenFullChat }: EllenChatWidgetProps) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const voornaam = user?.naam?.split(' ')[0] || '';
  const showWidget = isOpen || isHovered;

  // Initial welcome message
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        id: '1',
        role: 'ellen',
        content: voornaam
          ? `Hi ${voornaam}! Wat kan ik voor je doen?`
          : 'Hi! Wat kan ik voor je doen?'
      }]);
    }
  }, [isOpen, voornaam, messages.length]);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: inputValue.trim()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const sessionToken = getSessionToken();
      const { data, error } = await supabase.functions.invoke('ellen-chat', {
        body: {
          message: userMessage.content,
          sessie_id: crypto.randomUUID(),
        },
        headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {},
      });

      if (error) throw error;

      const ellenMessage: Message = {
        id: crypto.randomUUID(),
        role: 'ellen',
        content: data?.reply || 'Sorry, ik kon geen antwoord genereren.'
      };
      setMessages(prev => [...prev, ellenMessage]);
    } catch (error) {
      console.error('Ellen chat error:', error);
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'ellen',
        content: 'Sorry, er ging iets mis. Probeer het later opnieuw.'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Chat Window */}
      {isOpen && !isMinimized && (
        <div className="mb-3 w-[360px] h-[480px] bg-card rounded-2xl shadow-2xl border border-border overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-primary/5 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-primary" />
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
                  onClick={() => {
                    setIsOpen(false);
                    onOpenFullChat();
                  }}
                  title="Open volledig scherm"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setIsMinimized(true)}
                title="Minimaliseren"
              >
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setIsOpen(false)}
                title="Sluiten"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex",
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm",
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
                <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-border shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex gap-2"
            >
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Stel een vraag..."
                className="flex-1 text-sm"
                disabled={isLoading}
              />
              <Button
                type="submit"
                size="icon"
                disabled={!inputValue.trim() || isLoading}
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Minimized bar */}
      {isOpen && isMinimized && (
        <button
          onClick={() => setIsMinimized(false)}
          className="mb-3 flex items-center gap-2 px-4 py-2.5 bg-card rounded-full shadow-lg border border-border hover:bg-muted transition-colors animate-in slide-in-from-bottom-2 fade-in duration-200"
        >
          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-3 w-3 text-primary" />
          </div>
          <span className="text-sm font-medium text-foreground">Ellen</span>
          <X
            className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground ml-1"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
              setIsMinimized(false);
            }}
          />
        </button>
      )}

      {/* Floating Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          setIsMinimized(false);
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          "group flex items-center gap-2 rounded-full shadow-lg transition-all duration-300",
          isOpen
            ? "bg-muted px-4 py-3"
            : "bg-primary hover:bg-primary/90 px-4 py-3",
          showWidget && !isOpen && "pr-5"
        )}
      >
        <Sparkles className={cn(
          "h-5 w-5 transition-colors",
          isOpen ? "text-muted-foreground" : "text-primary-foreground"
        )} />
        <span className={cn(
          "text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-300",
          isOpen
            ? "text-muted-foreground max-w-[100px]"
            : "text-primary-foreground",
          showWidget && !isOpen ? "max-w-[100px] opacity-100" : "max-w-0 opacity-0"
        )}>
          {isOpen ? 'Sluiten' : 'Vraag Ellen'}
        </span>
      </button>
    </div>
  );
}
