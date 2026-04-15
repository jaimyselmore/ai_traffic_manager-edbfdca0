import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Clock, Eye, Bell, FolderOpen, Plus, FileEdit, Users, CalendarOff, Archive, X, CalendarDays, Briefcase, User, FileText, Hash, ExternalLink } from 'lucide-react';
import { StatCard } from './StatCard';
import { RequestBlock } from './RequestBlock';
import { MijnAanvragen } from './MijnAanvragen';
import { WachtOpGoedkeuring, getWachtKlantCount } from './WachtOpGoedkeuring';
import { getWeekNumber, getWeekStart, formatDateRange } from '@/lib/helpers/dateHelpers';
import { useUpcomingDeadlines, useActiveProjects, useInterneReviews, useWijzigingsverzoeken, useAfgerondeProjecten } from '@/lib/data';
import { useAuth } from '@/contexts/AuthContext';
import { ActiveProject } from '@/lib/data/dataService';

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
  const [selectedProject, setSelectedProject] = useState<ActiveProject | null>(null);

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
                    onClick={() => setSelectedProject(project)}
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

      {/* Project detail modal */}
      {selectedProject && (
        <ProjectDetailModal
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
          onOpenInPlanner={() => {
            setSelectedProject(null);
            navigate(`/planner?project=${selectedProject.id}`);
          }}
        />
      )}
    </div>
  );
}

// ── Project detail modal ──────────────────────────────────────────────────────

function ProjectDetailModal({
  project,
  onClose,
  onOpenInPlanner,
}: {
  project: ActiveProject;
  onClose: () => void;
  onOpenInPlanner: () => void;
}) {
  const statusLabel: Record<string, string> = {
    actief: 'Actief',
    in_behandeling: 'In behandeling',
    concept: 'Concept',
    wacht_klant: 'Wacht op klant',
    afgerond: 'Afgerond',
  };
  const statusColor: Record<string, string> = {
    actief: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    in_behandeling: 'bg-blue-100 text-blue-700 border-blue-200',
    concept: 'bg-slate-100 text-slate-600 border-slate-200',
    wacht_klant: 'bg-amber-100 text-amber-700 border-amber-200',
    afgerond: 'bg-purple-100 text-purple-700 border-purple-200',
  };

  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="relative w-full max-w-lg bg-background rounded-2xl shadow-2xl border border-border pointer-events-auto overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 border-b border-border">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  #{project.projectnummer}
                </span>
                {project.status && (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${statusColor[project.status] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                    {statusLabel[project.status] ?? project.status}
                  </span>
                )}
              </div>
              <h2 className="mt-2 text-lg font-semibold text-foreground leading-tight">
                {project.klant_naam}
              </h2>
              {project.omschrijving && (
                <p className="mt-1 text-sm text-muted-foreground">{project.omschrijving}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Details grid */}
          <div className="px-6 py-4 space-y-3">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <DetailRow icon={User} label="Aangemaakt door" value={project.aangemaakt_door_naam || '—'} />
              <DetailRow icon={Briefcase} label="Projecttype" value={project.projecttype ? capitalize(project.projecttype) : '—'} />
              <DetailRow icon={CalendarDays} label="Aanvraagdatum" value={fmt(project.datum_aanvraag)} />
              <DetailRow icon={CalendarDays} label="Deadline" value={fmt(project.deadline)} />
              <DetailRow icon={Hash} label="Ingeplande taken" value={String(project.takenCount)} />
            </div>

            {project.opmerkingen && (
              <div className="mt-3 pt-3 border-t border-border">
                <div className="flex items-start gap-2">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Opmerkingen</p>
                    <p className="text-sm text-foreground whitespace-pre-line">{project.opmerkingen}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-muted/30">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted"
            >
              Sluiten
            </button>
            <button
              type="button"
              onClick={onOpenInPlanner}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Bekijk in planner
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
