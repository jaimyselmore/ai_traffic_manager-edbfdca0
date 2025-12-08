import { useState, useEffect, useRef, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface ChatMessage {
  id: string;
  role: 'ellen' | 'user';
  content: string;
  isProposal?: boolean;
  timestamp?: Date;
}

interface EllenChatProps {
  contextSummary?: ReactNode;
  extraActions?: ReactNode;
  initialMessages?: ChatMessage[];
  isLoading?: boolean;
  onSendMessage?: (message: string) => void;
  showInput?: boolean;
}

export function EllenChat({ 
  contextSummary,
  extraActions,
  initialMessages = [],
  isLoading = false,
  onSendMessage,
  showInput = true
}: EllenChatProps) {
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);

  // Update messages when initialMessages changes
  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  // Scroll to bottom on new messages
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
      {/* Context summary at top if provided */}
      {contextSummary && (
        <div className="border-b border-border p-4">
          {contextSummary}
        </div>
      )}

      {/* Chat messages */}
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
            <div 
              className={`rounded-2xl px-3 py-2 text-sm max-w-[75%] whitespace-pre-wrap shadow-sm ${
                message.role === 'ellen' 
                  ? 'bg-card border border-border text-foreground' 
                  : 'bg-primary text-primary-foreground'
              }`}
            >
              {message.content}
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

      {/* Input + actions */}
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
            <div className="flex justify-end gap-2">
              {extraActions}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
