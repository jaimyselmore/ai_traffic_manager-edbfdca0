import { useState } from 'react';
import { X, Send, Check, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { mockEmployees, mockClients } from '@/lib/mockData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type RequestType = 'project' | 'wijziging' | 'meeting' | 'verlof';

interface RequestPanelProps {
  type: RequestType;
  isOpen: boolean;
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

const panelTitles: Record<RequestType, string> = {
  project: 'Nieuw project',
  wijziging: 'Wijzigingsverzoek',
  meeting: 'Meeting / Presentatie',
  verlof: 'Ziek / Verlof',
};

export function RequestPanel({ type, isOpen, onClose }: RequestPanelProps) {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'ai',
      content: 'Hallo! Ik help je graag met je verzoek. Vul het formulier in en ik zal een planning voorstellen.',
      timestamp: new Date(),
    },
  ]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: newMessage,
      timestamp: new Date(),
    };
    
    setChatMessages((prev) => [...prev, userMessage]);
    setNewMessage('');
    
    // Simulate AI response
    setTimeout(() => {
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: 'Bedankt voor je bericht! Ik heb je verzoek ontvangen en werk aan een planning voorstel. Dit kan een moment duren.',
        timestamp: new Date(),
      };
      setChatMessages((prev) => [...prev, aiMessage]);
    }, 1000);
  };

  const handlePlanAanpassen = async () => {
    setIsLoading(true);
    // Mock API call
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    const aiMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'ai',
      content: 'Ik heb een nieuw planningsvoorstel gemaakt op basis van je feedback. De taken zijn nu beter verdeeld over de beschikbare uren.',
      timestamp: new Date(),
    };
    setChatMessages((prev) => [...prev, aiMessage]);
    setIsLoading(false);
  };

  const handlePlanGoedkeuren = async () => {
    setIsLoading(true);
    // Mock API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    const aiMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'ai',
      content: 'De planning is goedgekeurd en toegevoegd aan de planner. Alle betrokken medewerkers zijn op de hoogte gebracht.',
      timestamp: new Date(),
    };
    setChatMessages((prev) => [...prev, aiMessage]);
    setIsLoading(false);
  };

  const renderFormFields = () => {
    if (type === 'verlof') {
      return (
        <>
          <div className="space-y-2">
            <Label htmlFor="medewerker">Medewerker</Label>
            <Select onValueChange={(value) => handleInputChange('medewerker', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecteer medewerker" />
              </SelectTrigger>
              <SelectContent>
                {mockEmployees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startdatum">Startdatum</Label>
              <Input
                id="startdatum"
                type="date"
                onChange={(e) => handleInputChange('startdatum', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="einddatum">Einddatum</Label>
              <Input
                id="einddatum"
                type="date"
                onChange={(e) => handleInputChange('einddatum', e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reden">Reden</Label>
            <Select onValueChange={(value) => handleInputChange('reden', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecteer reden" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ziek">Ziek</SelectItem>
                <SelectItem value="vakantie">Vakantie</SelectItem>
                <SelectItem value="persoonlijk">Persoonlijk verlof</SelectItem>
                <SelectItem value="anders">Anders</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      );
    }

    return (
      <>
        <div className="space-y-2">
          <Label htmlFor="klant">Klant</Label>
          <Select onValueChange={(value) => handleInputChange('klant', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecteer klant" />
            </SelectTrigger>
            <SelectContent>
              {mockClients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="deliverables">Deliverables / Format</Label>
          <Input
            id="deliverables"
            placeholder="Bijv. Social media campagne, video, poster"
            onChange={(e) => handleInputChange('deliverables', e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="deadline">Deadline</Label>
            <Input
              id="deadline"
              type="date"
              onChange={(e) => handleInputChange('deadline', e.target.value)}
            />
          </div>
          {type === 'meeting' && (
            <div className="space-y-2">
              <Label htmlFor="tijd">Tijd</Label>
              <Input
                id="tijd"
                type="time"
                onChange={(e) => handleInputChange('tijd', e.target.value)}
              />
            </div>
          )}
        </div>
        <div className="space-y-2">
          <Label>Betrokken medewerkers</Label>
          <Select onValueChange={(value) => handleInputChange('medewerkers', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecteer medewerkers" />
            </SelectTrigger>
            <SelectContent>
              {mockEmployees.map((emp) => (
                <SelectItem key={emp.id} value={emp.id}>
                  {emp.name} - {emp.role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </>
    );
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className="fixed right-0 top-0 z-50 h-full w-full max-w-lg bg-card shadow-2xl animate-slide-in-right">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h2 className="text-lg font-semibold text-foreground">{panelTitles[type]}</h2>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Form */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-4">
              {renderFormFields()}
              
              <div className="space-y-2">
                <Label htmlFor="opmerkingen">Opmerkingen</Label>
                <Textarea
                  id="opmerkingen"
                  placeholder="Extra informatie of wensen..."
                  rows={3}
                  onChange={(e) => handleInputChange('opmerkingen', e.target.value)}
                />
              </div>
            </div>

            {/* Chat Area */}
            <div className="mt-6 border-t border-border pt-6">
              <h3 className="mb-4 text-sm font-medium text-muted-foreground">
                Chat met AI Planning Assistent
              </h3>
              
              <div className="mb-4 max-h-48 space-y-3 overflow-y-auto rounded-lg bg-secondary/50 p-4">
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      'rounded-lg p-3 text-sm',
                      msg.role === 'ai'
                        ? 'bg-card text-foreground'
                        : 'bg-primary text-primary-foreground ml-8'
                    )}
                  >
                    {msg.content}
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="Typ een bericht..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                />
                <Button size="icon" onClick={handleSendMessage}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="border-t border-border p-6">
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handlePlanAanpassen}
                disabled={isLoading}
              >
                <RefreshCw className={cn('mr-2 h-4 w-4', isLoading && 'animate-spin')} />
                Plan aanpassen
              </Button>
              <Button
                className="flex-1"
                onClick={handlePlanGoedkeuren}
                disabled={isLoading}
              >
                <Check className="mr-2 h-4 w-4" />
                Plan goedkeuren
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
