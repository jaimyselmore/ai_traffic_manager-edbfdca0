import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { mockEmployees } from '@/lib/mockData';

interface ChatMessage {
  id: string;
  role: 'ellen' | 'user';
  content: string;
  isProposal?: boolean;
}

interface RequestData {
  requestType: 'project' | 'wijziging' | 'meeting' | 'verlof';
  formData: Record<string, any>;
}

// Confirmation Modal Component
function ConfirmModal({ 
  isOpen, 
  onConfirm, 
  onCancel 
}: { 
  isOpen: boolean; 
  onConfirm: () => void; 
  onCancel: () => void; 
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card rounded-xl shadow-lg max-w-md w-full mx-4 p-6 border border-border">
        <h2 className="text-lg font-semibold text-foreground mb-2">
          Wil je dit voorstel doorvoeren in de planning?
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Ellen zet het voorgestelde plan in de planner. Je kunt het daarna altijd nog handmatig aanpassen.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel}>
            Annuleren
          </Button>
          <Button onClick={onConfirm}>
            Ja, doorvoeren
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function EllenWorking() {
  const navigate = useNavigate();
  const location = useLocation();
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const { requestType, formData } = (location.state as RequestData) || { 
    requestType: 'project', 
    formData: {} 
  };

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [hasProposal, setHasProposal] = useState(false);

  // Get employee names from IDs
  const getEmployeeNames = (ids: string[] = []) => {
    return ids.map(id => mockEmployees.find(e => e.id === id)?.name || id).join(', ');
  };

  // Get request type label
  const getRequestTypeLabel = () => {
    switch (requestType) {
      case 'project': return 'Nieuw project';
      case 'wijziging': return 'Wijzigingsverzoek';
      case 'meeting': return 'Meeting / Presentatie';
      case 'verlof': return 'Beschikbaarheid medewerker';
      default: return 'Aanvraag';
    }
  };

  // Get initial Ellen proposal based on request type
  const getInitialProposal = () => {
    switch (requestType) {
      case 'project':
        return `Op basis van je aanvraag voor "${formData.projectnaam || 'het project'}" stel ik de volgende planning voor:\n\n` +
          `📅 Fasering:\n` +
          `• Week 1-2: Conceptontwikkeling\n` +
          `• Week 3: Interne review\n` +
          `• Week 4-5: Conceptuitwerking\n` +
          `• Week 6: Productie en afronding\n\n` +
          `👥 Teamverdeling:\n` +
          `${formData.medewerkers?.length > 0 ? getEmployeeNames(formData.medewerkers) : 'Nog te bepalen'}\n\n` +
          `Deadline: ${formData.deadline || 'Nog te bepalen'}\n\n` +
          `Laat me weten als je dit voorstel wilt aanpassen!`;
      case 'wijziging':
        return `Ik heb je wijzigingsverzoek bekeken voor "${formData.projectnaam || 'het project'}". ` +
          `Hier is mijn voorstel voor de aangepaste planning:\n\n` +
          `🔄 Wijziging: ${formData.wijzigingType || 'Scope aanpassing'}\n\n` +
          `📅 Aangepaste planning:\n` +
          `• De huidige taken worden verschoven\n` +
          `• Extra tijd gereserveerd voor: ${formData.beschrijving?.substring(0, 50) || 'de wijzigingen'}...\n\n` +
          `Wil je dat ik dit doorvoer in de planning?`;
      case 'meeting':
        return `Ik heb geschikte momenten gevonden voor je ${formData.meetingType || 'meeting'} over "${formData.onderwerp || 'het onderwerp'}":\n\n` +
          `📅 Voorgestelde datum: ${formData.datum || 'Nog te bepalen'}\n` +
          `🕐 Tijd: ${formData.starttijd || '10:00'} - ${formData.eindtijd || '11:00'}\n` +
          `📍 Locatie: ${formData.locatie || 'Nog te bepalen'}\n\n` +
          `👥 Deelnemers:\n` +
          `${formData.medewerkers?.length > 0 ? getEmployeeNames(formData.medewerkers) : 'Nog te bepalen'}\n\n` +
          `Alle deelnemers zijn op dit moment beschikbaar. Zal ik dit inplannen?`;
      case 'verlof':
        const employee = mockEmployees.find(e => e.id === formData.medewerker);
        return `Ik heb de beschikbaarheid van ${employee?.name || 'de medewerker'} bekeken.\n\n` +
          `📅 Periode: ${formData.startdatum || '...'} t/m ${formData.einddatum || '...'}\n` +
          `📋 Type: ${formData.verlofType || 'Verlof'}\n\n` +
          `Impact op de planning:\n` +
          `• 2 taken worden verschoven naar andere teamleden\n` +
          `• 1 deadline blijft haalbaar met huidige bezetting\n\n` +
          `Wil je dat ik deze afwezigheid doorvoer?`;
      default:
        return 'Ik bekijk je aanvraag en kom zo met een voorstel.';
    }
  };

  // Initialize chat with Ellen's greeting and proposal
  useEffect(() => {
    const initMessages: ChatMessage[] = [
      {
        id: '1',
        role: 'ellen',
        content: 'Hoi! Ik bekijk je aanvraag en kom zo met een voorstel voor de planning.'
      }
    ];
    setMessages(initMessages);

    // Simulate Ellen "thinking" and then proposing
    const timer = setTimeout(() => {
      setMessages(prev => [...prev, {
        id: '2',
        role: 'ellen',
        content: getInitialProposal(),
        isProposal: true
      }]);
      setIsLoading(false);
      setHasProposal(true);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue
    };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');

    // Simulate Ellen response
    setTimeout(() => {
      const responses = [
        'Goed punt! Ik pas het voorstel aan op basis van je feedback.',
        'Ik begrijp wat je bedoelt. Laat me een alternatief voorstel maken.',
        'Dat is een goede vraag. Ik heb gekeken naar de beschikbaarheid en dit lijkt de beste optie.',
        'Natuurlijk, ik kan de planning anders indelen. Wil je dat ik meer tijd reserveer voor de conceptfase?'
      ];
      const randomResponse = responses[Math.floor(Math.random() * responses.length)];
      
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'ellen',
        content: randomResponse
      }]);
    }, 1000);
  };

  const handleNewProposal = () => {
    setIsLoading(true);
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'ellen',
      content: 'Ik maak een nieuw voorstel op basis van onze conversatie...'
    }]);

    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'ellen',
        content: 'Hier is een alternatief voorstel:\n\n' +
          '📅 Aangepaste fasering:\n' +
          '• Week 1: Kick-off en briefing\n' +
          '• Week 2-3: Conceptontwikkeling\n' +
          '• Week 4: Review met stakeholders\n' +
          '• Week 5-6: Uitwerking en productie\n\n' +
          'Is dit meer wat je in gedachten had?',
        isProposal: true
      }]);
      setIsLoading(false);
    }, 1500);
  };

  const handleApprove = () => {
    setShowConfirmModal(true);
  };

  const handleConfirmApprove = () => {
    setShowConfirmModal(false);
    setIsApproved(true);
    
    // Mock API call to update planning
    toast({
      title: 'Voorstel goedgekeurd',
      description: 'Het voorstel van Ellen is toegevoegd aan de planner.',
    });
  };

  const handleBack = () => {
    navigate('/');
  };

  // Get summary fields based on request type
  const getSummaryFields = () => {
    const baseFields = [
      { label: 'Type aanvraag', value: getRequestTypeLabel() }
    ];

    switch (requestType) {
      case 'project':
        return [
          ...baseFields,
          { label: 'Klant', value: formData.klant || '-' },
          { label: 'Projectnaam', value: formData.projectnaam || '-' },
          { label: 'Deliverables', value: formData.deliverables || '-' },
          { label: 'Deadline', value: formData.deadline || '-' },
          { label: 'Medewerkers', value: getEmployeeNames(formData.medewerkers) || '-' },
        ];
      case 'wijziging':
        return [
          ...baseFields,
          { label: 'Klant', value: formData.klant || '-' },
          { label: 'Project', value: formData.projectnaam || '-' },
          { label: 'Type wijziging', value: formData.wijzigingType || '-' },
          { label: 'Deadline', value: formData.deadline || '-' },
        ];
      case 'meeting':
        return [
          ...baseFields,
          { label: 'Type', value: formData.meetingType || '-' },
          { label: 'Onderwerp', value: formData.onderwerp || '-' },
          { label: 'Datum', value: formData.datum || '-' },
          { label: 'Tijd', value: `${formData.starttijd || '-'} - ${formData.eindtijd || '-'}` },
          { label: 'Deelnemers', value: getEmployeeNames(formData.medewerkers) || '-' },
        ];
      case 'verlof':
        const employee = mockEmployees.find(e => e.id === formData.medewerker);
        return [
          ...baseFields,
          { label: 'Medewerker', value: employee?.name || '-' },
          { label: 'Type', value: formData.verlofType || '-' },
          { label: 'Startdatum', value: formData.startdatum || '-' },
          { label: 'Einddatum', value: formData.einddatum || '-' },
        ];
      default:
        return baseFields;
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      {/* Top: back link on its own row, far left */}
      <div className="w-full px-6 pt-6 mb-4">
        <button
          type="button"
          className="text-sm text-muted-foreground hover:text-foreground"
          onClick={handleBack}
        >
          ← Terug naar overzicht
        </button>
      </div>

      {/* Two column layout */}
      <div className="max-w-6xl mx-auto px-8 pb-8 grid grid-cols-1 lg:grid-cols-[1.1fr,1.9fr] gap-8 items-start">
        {/* Left: summary */}
        <section>
          <div className="flex items-center gap-3 mb-3">
            <div className="h-9 w-9 rounded-xl bg-sky-500 flex items-center justify-center text-white font-semibold text-xs">
              AI
            </div>
            <h1 className="text-xl font-semibold text-foreground">Ellen is aan het werk</h1>
          </div>
          
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            Ellen maakt een voorstel voor de planning op basis van je aanvraag.
            Zij past de planning nooit automatisch aan: jij geeft altijd het laatste akkoord.
          </p>

          <div className="bg-card rounded-xl shadow-sm border border-border p-4 mb-4">
            <h2 className="text-sm font-semibold text-foreground mb-3">Samenvatting van de aanvraag</h2>
            <dl className="space-y-2">
              {getSummaryFields().map((field, index) => (
                <div key={index} className="flex justify-between gap-2 text-sm">
                  <dt className="text-muted-foreground shrink-0">{field.label}</dt>
                  <dd className="text-foreground font-medium text-right truncate">
                    {field.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
            <strong>Belangrijk:</strong> Ellen past de planning pas aan nadat je op{' '}
            <em>Voorstel goedkeuren</em> klikt.
          </div>
        </section>

        {/* Right: chat with Ellen */}
        <section className="flex flex-col h-[65vh] bg-card rounded-2xl shadow-sm border border-border">
          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((message) => (
              <div 
                key={message.id} 
                className={`flex items-start gap-2 ${message.role === 'user' ? 'justify-end' : ''}`}
              >
                {message.role === 'ellen' && (
                  <div className="h-7 w-7 rounded-full bg-sky-500 flex items-center justify-center text-white text-[10px] font-semibold shrink-0">
                    E
                  </div>
                )}
                <div 
                  className={`rounded-2xl px-3 py-2 text-sm max-w-[80%] whitespace-pre-wrap ${
                    message.role === 'ellen' 
                      ? 'bg-slate-100 dark:bg-slate-800 text-foreground' 
                      : 'bg-sky-500 text-white'
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex items-start gap-2">
                <div className="h-7 w-7 rounded-full bg-sky-500 flex items-center justify-center text-white text-[10px] font-semibold">
                  E
                </div>
                <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl px-3 py-2 text-sm text-muted-foreground">
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
          <div className="border-t border-border p-3">
            {!isApproved ? (
              <>
                <div className="flex gap-2 mb-2">
                  <Input
                    type="text"
                    placeholder="Stel een vraag of vraag om een ander voorstel..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    className="flex-1 rounded-full text-sm h-9"
                  />
                  <Button size="sm" onClick={handleSendMessage} className="h-9">
                    Stuur
                  </Button>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={handleNewProposal} disabled={isLoading}>
                    Nieuw voorstel vragen
                  </Button>
                  <Button size="sm" onClick={handleApprove} disabled={!hasProposal || isLoading}>
                    Voorstel goedkeuren
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-3">
                <p className="text-sm text-muted-foreground mb-3">
                  ✓ Het voorstel van Ellen is toegevoegd aan de planner.
                </p>
                <Button onClick={() => navigate('/?tab=planner')}>
                  Ga naar planner
                </Button>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={showConfirmModal}
        onConfirm={handleConfirmApprove}
        onCancel={() => setShowConfirmModal(false)}
      />
    </div>
  );
}
