import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { EllenChat, ChatMessage } from '@/components/chat/EllenChat';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';

type RequestType = 'project' | 'wijziging' | 'meeting' | 'verlof';

interface LocationState {
  requestType: RequestType;
  formData: Record<string, unknown>;
}

const getInitialMessage = (requestType: RequestType, formData: Record<string, unknown>): string => {
  switch (requestType) {
    case 'project':
      return `Ik heb je nieuwe projectaanvraag voor ${formData.klant || 'de klant'} – "${formData.projectnaam || 'het project'}" bekeken. 

Hier is mijn voorstel voor de opstart en fasering:

**Fasering:**
1. Week 1-2: Kickoff & conceptontwikkeling
2. Week 3-4: Eerste conceptuitwerking en interne review
3. Week 5-6: Productie en finalisatie

${formData.medewerkers && (formData.medewerkers as string[]).length > 0 
  ? `**Voorgesteld team:** ${(formData.medewerkers as string[]).join(', ')}`
  : '**Team:** Ik stel voor om het team samen te stellen op basis van beschikbaarheid.'}

Wil je dat ik dit voorstel aanpas of heb je vragen?`;

    case 'wijziging':
      return `Ik heb je wijzigingsverzoek voor ${formData.klant || 'de klant'} – "${formData.projectnaam || 'het project'}" bekeken.

**Type wijziging:** ${formData.wijzigingType || 'Niet gespecificeerd'}

Dit is mijn voorstel voor de aangepaste planning:

- De wijziging kan worden doorgevoerd zonder grote impact op andere projecten
- Geschatte extra tijd: 4-8 uur
${formData.deadline ? `- Nieuwe deadline: ${formData.deadline}` : ''}

Heb je vragen over dit voorstel?`;

    case 'meeting':
      return `Ik heb je verzoek voor een ${formData.meetingType || 'meeting'} bekeken.

**Onderwerp:** ${formData.onderwerp || 'Niet gespecificeerd'}
**Datum:** ${formData.datum || 'Nog te bepalen'}
**Tijd:** ${formData.starttijd || '—'} - ${formData.eindtijd || '—'}

Dit zijn de betrokken deelnemers: ${
  formData.medewerkers && (formData.medewerkers as string[]).length > 0 
    ? (formData.medewerkers as string[]).join(', ')
    : 'Nog geen deelnemers geselecteerd'
}

Alle deelnemers zijn beschikbaar op het voorgestelde moment. Wil je dat ik de meeting inplan?`;

    case 'verlof':
      return `Ik heb de gewijzigde beschikbaarheid van ${formData.medewerker || 'de medewerker'} bekeken.

**Type:** ${formData.verlofType || 'Niet gespecificeerd'}
**Periode:** ${formData.startdatum || '—'} t/m ${formData.einddatum || '—'}

Zo kunnen we dit in de planning verwerken:
- Lopende taken worden herverdeeld over het team
- Deadlines die binnen de afwezigheid vallen worden gecontroleerd

Er zijn geen conflicten gevonden. Wil je dat ik de beschikbaarheid definitief aanpas?`;

    default:
      return 'Ik heb je aanvraag bekeken. Hoe kan ik je helpen?';
  }
};

const getRequestTitle = (requestType: RequestType): string => {
  switch (requestType) {
    case 'project':
      return 'Nieuw project';
    case 'wijziging':
      return 'Wijzigingsverzoek';
    case 'meeting':
      return 'Meeting / Presentatie';
    case 'verlof':
      return 'Beschikbaarheid medewerker';
    default:
      return 'Aanvraag';
  }
};

const renderSummaryFields = (requestType: RequestType, formData: Record<string, unknown>) => {
  const fields: { label: string; value: string }[] = [];

  switch (requestType) {
    case 'project':
      if (formData.klant) fields.push({ label: 'Klant', value: String(formData.klant) });
      if (formData.projectnaam) fields.push({ label: 'Projectnaam', value: String(formData.projectnaam) });
      if (formData.projectType) fields.push({ label: 'Type', value: String(formData.projectType) });
      if (formData.deliverables) fields.push({ label: 'Deliverables', value: String(formData.deliverables) });
      if (formData.deadline) fields.push({ label: 'Deadline', value: String(formData.deadline) });
      if (formData.indicatievePeriode) fields.push({ label: 'Indicatieve periode', value: String(formData.indicatievePeriode) });
      if (formData.prioriteit) fields.push({ label: 'Prioriteit', value: String(formData.prioriteit) });
      if (formData.medewerkers && (formData.medewerkers as string[]).length > 0) {
        fields.push({ label: 'Team', value: (formData.medewerkers as string[]).join(', ') });
      }
      break;
    case 'wijziging':
      if (formData.klant) fields.push({ label: 'Klant', value: String(formData.klant) });
      if (formData.projectnaam) fields.push({ label: 'Project', value: String(formData.projectnaam) });
      if (formData.wijzigingType) fields.push({ label: 'Type wijziging', value: String(formData.wijzigingType) });
      if (formData.beschrijving) fields.push({ label: 'Beschrijving', value: String(formData.beschrijving) });
      if (formData.deadline) fields.push({ label: 'Deadline', value: String(formData.deadline) });
      break;
    case 'meeting':
      if (formData.klant) fields.push({ label: 'Klant', value: String(formData.klant) });
      if (formData.onderwerp) fields.push({ label: 'Onderwerp', value: String(formData.onderwerp) });
      if (formData.meetingType) fields.push({ label: 'Type', value: String(formData.meetingType) });
      if (formData.datum) fields.push({ label: 'Datum', value: String(formData.datum) });
      if (formData.starttijd && formData.eindtijd) {
        fields.push({ label: 'Tijd', value: `${formData.starttijd} - ${formData.eindtijd}` });
      }
      if (formData.locatie) fields.push({ label: 'Locatie', value: String(formData.locatie) });
      if (formData.medewerkers && (formData.medewerkers as string[]).length > 0) {
        fields.push({ label: 'Deelnemers', value: (formData.medewerkers as string[]).join(', ') });
      }
      break;
    case 'verlof':
      if (formData.medewerker) fields.push({ label: 'Medewerker', value: String(formData.medewerker) });
      if (formData.verlofType) fields.push({ label: 'Type', value: String(formData.verlofType) });
      if (formData.startdatum) fields.push({ label: 'Startdatum', value: String(formData.startdatum) });
      if (formData.einddatum) fields.push({ label: 'Einddatum', value: String(formData.einddatum) });
      if (formData.reden) fields.push({ label: 'Reden', value: String(formData.reden) });
      break;
  }

  return fields;
};

export default function EllenConversationPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState | null;

  const requestType = state?.requestType || 'project';
  const formData = state?.formData || {};

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Generate initial Ellen message on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      const initialMessage = getInitialMessage(requestType, formData);
      setMessages([
        {
          id: '1',
          role: 'ellen',
          content: initialMessage,
          isProposal: true,
          timestamp: new Date(),
        },
      ]);
      setIsLoading(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, [requestType, formData]);

  const handleSendMessage = (message: string) => {
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    // Simulate Ellen response
    setTimeout(() => {
      const ellenResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'ellen',
        content: 'Goed punt! Ik pas het voorstel aan op basis van je feedback. Geef me even een moment...',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, ellenResponse]);
      setIsLoading(false);
    }, 1500);
  };

  const handleNewProposal = () => {
    setIsLoading(true);
    setTimeout(() => {
      const newProposal: ChatMessage = {
        id: Date.now().toString(),
        role: 'ellen',
        content: `Hier is een alternatief voorstel:

**Aangepaste fasering:**
1. Week 1: Snelle start met direct focus op kerndeliverables
2. Week 2-3: Parallel werken aan concept en uitwerking
3. Week 4: Finalisatie en oplevering

Dit bespaart ongeveer een week. Wat vind je van deze aanpak?`,
        isProposal: true,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, newProposal]);
      setIsLoading(false);
    }, 2000);
  };

  const handleApproveProposal = () => {
    setShowConfirmDialog(true);
  };

  const confirmApproval = async () => {
    setShowConfirmDialog(false);
    
    toast({
      title: 'Voorstel wordt verwerkt...',
      description: 'Ellen schrijft het voorstel naar de planning.',
    });

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000));

    toast({
      title: 'Voorstel goedgekeurd',
      description: 'De planning is bijgewerkt.',
    });

    navigate('/');
  };

  const summaryFields = renderSummaryFields(requestType, formData);

  const extraActions = (
    <>
      <Button variant="outline" size="sm" onClick={handleNewProposal} disabled={isLoading}>
        Nieuw voorstel vragen
      </Button>
      <Button size="sm" onClick={handleApproveProposal} disabled={isLoading || messages.length === 0}>
        Voorstel goedkeuren
      </Button>
    </>
  );

  return (
    <div className="h-full flex flex-col bg-muted/30">
      {/* Top bar */}
      <div className="px-8 pt-6 pb-4 border-b border-border bg-card">
        <button
          type="button"
          className="text-sm text-muted-foreground hover:text-foreground mb-2"
          onClick={() => navigate('/')}
        >
          ← Terug naar overzicht
        </button>
        <h1 className="text-2xl font-semibold text-foreground">
          Ellen – voorstel voor de planning
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ellen bekijkt je aanvraag en doet een voorstel voor de planning.
          Zij past de planning nooit automatisch aan: jij geeft altijd het laatste akkoord.
        </p>
      </div>

      {/* Main area: summary + chat */}
      <div className="flex-1 px-8 pb-6 pt-4 grid grid-cols-1 lg:grid-cols-[1fr,2fr] gap-6 min-h-0 overflow-hidden">
        {/* Left: summary of the submitted template */}
        <aside className="bg-card rounded-2xl border border-border shadow-sm p-4 h-fit self-start">
          <h2 className="text-sm font-semibold text-foreground mb-3">
            {getRequestTitle(requestType)}
          </h2>
          <div className="space-y-2">
            {summaryFields.map((field, index) => (
              <div key={index} className="text-sm">
                <span className="text-muted-foreground">{field.label}:</span>{' '}
                <span className="text-foreground">{field.value}</span>
              </div>
            ))}
            {summaryFields.length === 0 && (
              <p className="text-sm text-muted-foreground">Geen gegevens beschikbaar.</p>
            )}
          </div>
        </aside>

        {/* Right: LARGE Ellen chat */}
        <div className="min-h-0 flex flex-col">
          <EllenChat
            initialMessages={messages}
            isLoading={isLoading}
            onSendMessage={handleSendMessage}
            extraActions={extraActions}
          />
        </div>
      </div>

      {/* Confirmation dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Voorstel goedkeuren?</AlertDialogTitle>
            <AlertDialogDescription>
              Door dit voorstel goed te keuren, wordt de planning bijgewerkt. 
              Dit kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={confirmApproval}>
              Ja, goedkeuren
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
