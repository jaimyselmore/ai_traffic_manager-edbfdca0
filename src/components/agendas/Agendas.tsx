import { Eye, Upload } from 'lucide-react';

interface AgendaCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
}

function AgendaCard({ title, description, icon, onClick }: AgendaCardProps) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-6 text-left transition-all hover:shadow-md hover:border-primary/50 hover:bg-accent"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary">
        {icon}
      </div>
      <div>
        <h3 className="font-semibold text-base text-foreground">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
    </button>
  );
}

interface AgendasProps {
  onNavigate: (page: 'beschikbaarheid' | 'planning-plaatsen') => void;
}

export function Agendas({ onNavigate }: AgendasProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Microsoft agenda's</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Werk met de Microsoft-agenda's van medewerkers: beschikbaarheid ophalen en planning plaatsen.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Microsoft accounts koppelen? Ga naar <span className="font-medium text-foreground">Instellingen → Agenda's</span>.
        </p>
      </div>

      {/* Cards Grid */}
      <div className="grid gap-6 md:grid-cols-2 max-w-3xl">
        <AgendaCard
          title="Beschikbaarheid medewerkers"
          description="Haal de beschikbaarheid van een medewerker op uit Microsoft-agenda's en bekijk 1–4 weken in een agenda-overzicht."
          icon={<Eye className="h-6 w-6 text-foreground" />}
          onClick={() => onNavigate('beschikbaarheid')}
        />
        <AgendaCard
          title="Planning plaatsen in Microsoft-agenda's"
          description="Plaats bevestigde planningsblokken in de Microsoft-agenda van een medewerker."
          icon={<Upload className="h-6 w-6 text-foreground" />}
          onClick={() => onNavigate('planning-plaatsen')}
        />
      </div>
    </div>
  );
}
