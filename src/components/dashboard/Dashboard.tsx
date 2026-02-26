import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Clock, Eye, Bell, FolderOpen, Plus, FileEdit, Users, CalendarOff, Archive, X } from 'lucide-react';
import { StatCard } from './StatCard';
import { RequestBlock } from './RequestBlock';
import { MijnAanvragen } from './MijnAanvragen';
import { WachtOpGoedkeuring, getWachtKlantCount } from './WachtOpGoedkeuring';
import { getWeekNumber, getWeekStart, formatDateRange } from '@/lib/helpers/dateHelpers';
import { useUpcomingDeadlines, useActiveProjects, useInterneReviews, useWijzigingsverzoeken, useAfgerondeProjecten } from '@/lib/data';
import { useAuth } from '@/contexts/AuthContext';

interface DashboardProps {
  selectedEmployeeId: string;
}

type PanelType = 'wacht_klant' | 'deadlines' | 'reviews' | 'changes' | 'active' | 'afgerond' | null;

export function Dashboard({ selectedEmployeeId: _selectedEmployeeId }: DashboardProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: upcomingDeadlines = [] } = useUpcomingDeadlines();
  const { data: activeProjects = [] } = useActiveProjects();
  const { data: interneReviews = [] } = useInterneReviews();
  const { data: wijzigingsverzoeken = [] } = useWijzigingsverzoeken();
  const { data: afgerondeProjecten = [] } = useAfgerondeProjecten();

  const [wachtKlantCount, setWachtKlantCount] = useState(0);
  const [activePanel, setActivePanel] = useState<PanelType>(null);

  // Load wacht_klant count
  useEffect(() => {
    getWachtKlantCount()
      .then(setWachtKlantCount)
      .catch((error) => console.error('Failed to load wacht klant count:', error));
  }, []);

  const today = new Date();
  const weekStart = getWeekStart(today);
  const weekNumber = getWeekNumber(today);
  const dateRange = formatDateRange(weekStart);

  // Gebruik de naam van de ingelogde gebruiker
  const employeeName = user?.naam?.split(' ')[0] || 'Gebruiker';

  // Echte counts uit database
  const upcomingDeadlinesCount = upcomingDeadlines.length;
  const activeProjectsCount = activeProjects.length;
  const afgerondeProjectenCount = afgerondeProjecten.length;
  const reviewsCount = interneReviews.length;
  const changesCount = wijzigingsverzoeken.length;

  // Toggle panel - sluit als dezelfde geklikt wordt, open anders de nieuwe
  const togglePanel = (panel: PanelType) => {
    setActivePanel(current => current === panel ? null : panel);
  };

  // Statistieken met prioriteit - hoogste eerst (links)
  const statsConfig = useMemo(() => {
    const stats = [
      {
        id: 'wacht_klant' as const,
        title: 'Wacht op goedkeuring',
        value: wachtKlantCount,
        icon: CheckCircle2,
        variant: wachtKlantCount > 0 ? 'warning' as const : 'default' as const,
        priority: wachtKlantCount > 0 ? 5 : 0,
      },
      {
        id: 'deadlines' as const,
        title: 'Aankomende deadlines',
        value: upcomingDeadlinesCount,
        icon: Clock,
        variant: upcomingDeadlinesCount > 3 ? 'danger' as const : upcomingDeadlinesCount > 0 ? 'warning' as const : 'default' as const,
        priority: upcomingDeadlinesCount > 3 ? 4 : upcomingDeadlinesCount > 0 ? 3 : 0,
      },
      {
        id: 'reviews' as const,
        title: 'Interne reviews',
        value: reviewsCount,
        icon: Eye,
        variant: reviewsCount > 0 ? 'info' as const : 'default' as const,
        priority: reviewsCount > 0 ? 2 : 0,
      },
      {
        id: 'changes' as const,
        title: 'Wijzigingsverzoeken',
        value: changesCount,
        icon: Bell,
        variant: changesCount > 0 ? 'warning' as const : 'default' as const,
        priority: changesCount > 0 ? 2 : 0,
      },
      {
        id: 'active' as const,
        title: 'Actieve projecten',
        value: activeProjectsCount,
        icon: FolderOpen,
        variant: activeProjectsCount > 0 ? 'success' as const : 'default' as const,
        priority: activeProjectsCount > 0 ? 1 : 0,
      },
      {
        id: 'afgerond' as const,
        title: 'Afgeronde projecten',
        value: afgerondeProjectenCount,
        icon: Archive,
        variant: 'default' as const,
        priority: 0,
      },
    ];

    // Sorteer op prioriteit (hoogste eerst), behoud volgorde bij gelijke prioriteit
    return stats.sort((a, b) => b.priority - a.priority);
  }, [wachtKlantCount, upcomingDeadlinesCount, reviewsCount, changesCount, activeProjectsCount, afgerondeProjectenCount]);

  // Panel content renderer
  const renderPanelContent = () => {
    if (!activePanel) return null;

    const panelHeader = (title: string) => (
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <button
          onClick={() => setActivePanel(null)}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );

    switch (activePanel) {
      case 'wacht_klant':
        if (wachtKlantCount === 0) {
          return (
            <div className="rounded-lg border bg-card p-4">
              {panelHeader('Wacht op goedkeuring')}
              <p className="text-center text-muted-foreground py-4">Geen items wachten op goedkeuring</p>
            </div>
          );
        }
        return (
          <div className="rounded-lg border bg-card p-4">
            {panelHeader('Wacht op goedkeuring')}
            <WachtOpGoedkeuring />
          </div>
        );

      case 'afgerond':
        return (
          <div className="rounded-lg border bg-card p-4">
            {panelHeader('Afgeronde projecten')}
            {afgerondeProjecten.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">Geen afgeronde projecten</p>
            ) : (
              <div className="space-y-2">
                {afgerondeProjecten.map((project) => (
                  <div key={project.id} className="rounded-lg border bg-slate-50 p-3 opacity-75">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-slate-600">{project.projectnummer}</span>
                        <span className="mx-2 text-slate-400">•</span>
                        <span className="text-slate-500">{project.klant_naam}</span>
                      </div>
                      <div className="text-sm text-slate-400">
                        Afgerond: {project.afgerond_op ? new Date(project.afgerond_op).toLocaleDateString('nl-NL') : '-'}
                      </div>
                    </div>
                    {project.omschrijving && (
                      <p className="mt-1 text-sm text-slate-400">{project.omschrijving}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'active':
        return (
          <div className="rounded-lg border bg-card p-4">
            {panelHeader('Actieve projecten')}
            {activeProjects.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">Geen actieve projecten</p>
            ) : (
              <div className="space-y-2">
                {activeProjects.map((project) => (
                  <div
                    key={project.id}
                    onClick={() => navigate(`/planner?project=${project.id}`)}
                    className="rounded-lg border bg-card p-3 cursor-pointer hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-foreground">{project.projectnummer}</span>
                        <span className="mx-2 text-muted-foreground">•</span>
                        <span className="text-muted-foreground">{project.klant_naam}</span>
                      </div>
                      {project.deadline && (
                        <div className="text-sm text-muted-foreground">
                          Deadline: {new Date(project.deadline).toLocaleDateString('nl-NL')}
                        </div>
                      )}
                    </div>
                    {project.omschrijving && (
                      <p className="mt-1 text-sm text-muted-foreground">{project.omschrijving}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'deadlines':
        return (
          <div className="rounded-lg border bg-card p-4">
            {panelHeader('Aankomende deadlines')}
            {upcomingDeadlines.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">Geen aankomende deadlines</p>
            ) : (
              <div className="space-y-2">
                {upcomingDeadlines.map((deadline) => (
                  <div
                    key={deadline.id}
                    onClick={() => navigate(`/planner?project=${deadline.id}`)}
                    className={`rounded-lg border p-3 cursor-pointer hover:bg-accent/50 transition-colors ${
                      deadline.severity === 'high' ? 'border-destructive/50 bg-destructive/5' :
                      deadline.severity === 'medium' ? 'border-warning/50 bg-warning/5' : 'bg-card'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-foreground">{deadline.projectnummer}</span>
                        <span className="mx-2 text-muted-foreground">•</span>
                        <span className="text-muted-foreground">{deadline.klant_naam}</span>
                      </div>
                      <div className={`text-sm font-medium ${
                        deadline.severity === 'high' ? 'text-destructive' :
                        deadline.severity === 'medium' ? 'text-warning' : 'text-muted-foreground'
                      }`}>
                        {new Date(deadline.deadline).toLocaleDateString('nl-NL')}
                      </div>
                    </div>
                    {deadline.omschrijving && (
                      <p className="mt-1 text-sm text-muted-foreground">{deadline.omschrijving}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'reviews':
        return (
          <div className="rounded-lg border bg-card p-4">
            {panelHeader('Interne reviews')}
            {interneReviews.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">Geen interne reviews</p>
            ) : (
              <div className="space-y-2">
                {interneReviews.map((review) => (
                  <div
                    key={review.id}
                    onClick={() => navigate('/interne-reviews')}
                    className="rounded-lg border bg-primary/5 border-primary/30 p-3 cursor-pointer hover:bg-primary/10 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-foreground">{review.projectnummer || 'Review'}</span>
                        {review.klant_naam && (
                          <>
                            <span className="mx-2 text-muted-foreground">•</span>
                            <span className="text-muted-foreground">{review.klant_naam}</span>
                          </>
                        )}
                      </div>
                      <span className="text-sm text-primary font-medium">Plan review →</span>
                    </div>
                    {review.beschrijving && (
                      <p className="mt-1 text-sm text-muted-foreground">{review.beschrijving}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'changes':
        return (
          <div className="rounded-lg border bg-card p-4">
            {panelHeader('Wijzigingsverzoeken')}
            {wijzigingsverzoeken.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">Geen wijzigingsverzoeken</p>
            ) : (
              <div className="space-y-2">
                {wijzigingsverzoeken.map((verzoek) => (
                  <div
                    key={verzoek.id}
                    onClick={() => navigate(`/wijzigingsverzoek/${verzoek.id}`)}
                    className="rounded-lg border bg-warning/5 border-warning/30 p-3 cursor-pointer hover:bg-warning/10 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-foreground">{verzoek.projectnummer || 'Wijziging'}</span>
                        {verzoek.klant_naam && (
                          <>
                            <span className="mx-2 text-muted-foreground">•</span>
                            <span className="text-muted-foreground">{verzoek.klant_naam}</span>
                          </>
                        )}
                      </div>
                      <span className="text-sm text-warning font-medium">Bekijk →</span>
                    </div>
                    {verzoek.titel && (
                      <p className="mt-1 text-sm text-muted-foreground">{verzoek.titel}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Welkom, {employeeName}
        </h1>
        <p className="mt-1 text-base text-muted-foreground">
          Week {weekNumber} – {dateRange}
        </p>
      </div>

      {/* Stats Grid - dynamisch gesorteerd op prioriteit */}
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {statsConfig.map((stat) => (
            <StatCard
              key={stat.id}
              title={stat.title}
              value={stat.value}
              icon={stat.icon}
              variant={stat.variant}
              onClick={() => togglePanel(stat.id)}
              isActive={activePanel === stat.id}
            />
          ))}
        </div>

        {/* Panel content - direct onder de badges */}
        {renderPanelContent()}
      </div>

      {/* Request Blocks */}
      <div>
        <h2 className="mb-6 text-xl font-semibold text-foreground">Nieuwe aanvraag</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <RequestBlock
            label="Nieuw project"
            description="Maak een nieuw project aan in de planning met klant, team en globale timing."
            icon={Plus}
            onClick={() => navigate('/nieuw-project')}
            variant="primary"
          />
          <RequestBlock
            label="Wijziging"
            description="Pas de planning van een bestaand project aan (scope, timing, team of uren)."
            icon={FileEdit}
            onClick={() => navigate('/wijzigingsverzoek')}
          />
          <RequestBlock
            label="Meeting / Presentatie"
            description="Plan een interne of externe meeting of presentatie en koppel die aan het juiste project en team."
            icon={Users}
            onClick={() => navigate('/meeting')}
          />
          <RequestBlock
            label="Beschikbaarheid medewerker"
            description="Leg afwezigheid, vakantie, verlof of een gewijzigde parttime-dag van een medewerker vast."
            icon={CalendarOff}
            onClick={() => navigate('/verlof')}
          />
        </div>
      </div>

      {/* Mijn Aanvragen Sectie */}
      <div>
        <h2 className="mb-6 text-xl font-semibold text-foreground">Mijn aanvragen</h2>
        <MijnAanvragen />
      </div>
    </div>
  );
}
