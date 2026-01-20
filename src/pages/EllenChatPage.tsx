import { useState } from 'react';
import { EllenChat, ChatMessage } from '@/components/chat/EllenChat';

export default function EllenChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'ellen',
      content: 'Hoi! Ik ben Ellen, je AI-assistent voor planning. Stel gerust een vraag over projecten, capaciteit, deadlines of teamverdeling. Ik denk graag met je mee!'
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSendMessage = (message: string) => {
    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: message
    };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    // Simulate Ellen response
    setTimeout(() => {
      const responses = [
        'Dat is een goede vraag! Laat me even kijken naar de huidige planning en beschikbaarheid...',
        'Ik begrijp wat je bedoelt. Op basis van de projecten die nu lopen, zou ik adviseren om...',
        'Interessant! Ik zie dat het team vrij druk bezet is de komende weken. Misschien kunnen we...',
        'Goed punt. De deadline is inderdaad krap, maar als we de taken anders verdelen zou het kunnen lukken.',
        'Laat me de capaciteit checken. Ik zie nog ruimte bij een paar teamleden in week 48.'
      ];
      const randomResponse = responses[Math.floor(Math.random() * responses.length)];
      
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'ellen',
        content: randomResponse
      }]);
      setIsLoading(false);
    }, 1200);
  };

  return (
    <div className="h-full flex flex-col space-y-8">
      <div className="px-6 pt-0">
        <h1 className="text-2xl font-bold text-foreground">Ellen</h1>
        <p className="mt-1 text-base text-muted-foreground">
          Stel je vraag over de planning, projecten of capaciteit
        </p>
      </div>

      <div className="flex-1 px-6 pb-6">
        <EllenChat 
          initialMessages={messages}
          isLoading={isLoading}
          onSendMessage={handleSendMessage}
        />
      </div>
    </div>
  );
}
