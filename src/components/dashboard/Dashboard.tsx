import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2, Clock, Eye, Bell, FolderOpen, Plus, FileEdit, Users, CalendarOff, Archive,
  X, CalendarDays, Briefcase, User, FileText, Hash, ExternalLink, Tag, ArrowRightLeft,
} from 'lucide-react';
import { StatCard } from './StatCard';
import { RequestBlock } from './RequestBlock';
import { MijnAanvragen } from './MijnAanvragen';
import { WachtOpGoedkeuring, getWachtKlantCount } from './WachtOpGoedkeuring';
import { getWeekNumber, getWeekStart, formatDateRange } from '@/lib/helpers/dateHelpers';
import {
  useUpcomingDeadlines, useActiveProjects, useInterneReviews,
  useWijzigingsverzoeken, useAfgerondeProjecten,
} from '@/lib/data';
import { useAuth } from '@/contexts/AuthContext';
import type { ActiveProject, UpcomingDeadline, InterneReview, Wijzigingsverzoek, AfgerondProject } from '@/lib/data/dataService';

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

  // Modal state voor elk type
  const [selectedProject, setSelectedProject] = useState<ActiveProject | null>(null);
  const [selectedDeadline, setSelectedDeadline] = useState<UpcomingDeadline | null>(null);
  const [selectedReview, setSelectedReview] = useState<InterneReview | null>(null);
  const [selectedVerzoek, setSelectedVerzoek] = useState<Wijzigingsverzoek | null>(null);
  const [selectedAfgerond, setSelectedAfgerond] = useState<AfgerondProject | null>(null);

  useEffect(() => {
    getWachtKlantCount()
      .then(setWachtKlantCount)
      .catch((error) => console.error('Failed to load wacht klant count:', error));
  }, []);

  const today = new Date();
  const weekStart = getWeekStart(today);
  const weekNumber = getWeekNumber(today);
  const dateRange = formatDateRange(weekStart);

  const employeeName = user?.naam?.split(' ')[0] || 'Gebruiker';

  const upcomingDeadlinesCount = upcomingDeadlines.length;
  const activeProjectsCount = activeProjects.length;
  const afgerondeProjectenCount = afgerondeProjecten.length;
  const reviewsCount = interneReviews.length;
  const changesCount = wijzigingsverzoeken.length;

  const togglePanel = (panel: PanelType) => {
    setActivePanel(current => current === panel ? null : panel);
  };

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
    return stats.sort((a, b) => b.priority - a.priority);
  }, [wachtKlantCount, upcomingDeadlinesCount, reviewsCount, changesCount, activeProjectsCount, afgerondeProjectenCount]);

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

  const renderPanelContent = () => {
    if (!activePanel) return null;

    switch (activePanel) {
      case 'wacht_klant':
        return (
          <div className="rounded-lg border bg-card p-4">
            {panelHeader('Wacht op goedkeuring')}
            {wachtKlantCount === 0
              ? <p className="text-center text-muted-foreground py-4">Geen items wachten op goedkeuring</p>
              : <WachtOpGoedkeuring />
            }
          </div>
        );

      case 'deadlines':
        return (
          <div className="rounded-lg border bg-card p-4">
            {panelHeader('Aankomende deadlines')}
            {upcomingDeadlines.length === 0
              ? <p className="text-center text-muted-foreground py-4">Geen aankomende deadlines</p>
              : (
                <div className="space-y-2">
                  {upcomingDeadlines.map((deadline) => (
                    <div
                      key={deadline.id}
                      onClick={() => setSelectedDeadline(deadline)}
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
              )
            }
          </div>
        );

      case 'active':
        return (
          <div className="rounded-lg border bg-card p-4">
            {panelHeader('Actieve projecten')}
            {activeProjects.length === 0
              ? <p className="text-center text-muted-foreground py-4">Geen actieve projecten</p>
              : (
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
              )
            }
          </div>
        );

      case 'afgerond':
        return (
          <div className="rounded-lg border bg-card p-4">
            {panelHeader('Afgeronde projecten')}
            {afgerondeProjecten.length === 0
              ? <p className="text-center text-muted-foreground py-4">Geen afgeronde projecten</p>
              : (
                <div className="space-y-2">
                  {afgerondeProjecten.map((project) => (
                    <div
                      key={project.id}
                      onClick={() => setSelectedAfgerond(project)}
                      className="rounded-lg border bg-slate-50 p-3 cursor-pointer hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-slate-600">{project.projectnummer}</span>
                          <span className="mx-2 text-slate-400">•</span>
                          <span className="text-slate-500">{project.klant_naam}</span>
                        </div>
                        <div className="text-sm text-slate-400">
                          {project.afgerond_op ? new Date(project.afgerond_op).toLocaleDateString('nl-NL') : '-'}
                        </div>
                      </div>
                      {project.omschrijving && (
                        <p className="mt-1 text-sm text-slate-400">{project.omschrijving}</p>
                      )}
                    </div>
                  ))}
                </div>
              )
            }
          </div>
        );

      case 'reviews':
        return (
          <div className="rounded-lg border bg-card p-4">
            {panelHeader('Interne reviews')}
            {interneReviews.length === 0
              ? <p className="text-center text-muted-foreground py-4">Geen interne reviews</p>
              : (
                <div className="space-y-2">
                  {interneReviews.map((review) => (
                    <div
                      key={review.id}
                      onClick={() => setSelectedReview(review)}
                      className="rounded-lg border bg-primary/5 border-primary/30 p-3 cursor-pointer hover:bg-primary/10 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-foreground">{review.titel || 'Review'}</span>
                          {review.klant_naam && (
                            <>
                              <span className="mx-2 text-muted-foreground">•</span>
                              <span className="text-muted-foreground">{review.klant_naam}</span>
                            </>
                          )}
                        </div>
                        <PrioriteitBadge prioriteit={review.prioriteit} />
                      </div>
                      {review.beschrijving && (
                        <p className="mt-1 text-sm text-muted-foreground line-clamp-1">{review.beschrijving}</p>
                      )}
                    </div>
                  ))}
                </div>
              )
            }
          </div>
        );

      case 'changes':
        return (
          <div className="rounded-lg border bg-card p-4">
            {panelHeader('Wijzigingsverzoeken')}
            {wijzigingsverzoeken.length === 0
              ? <p className="text-center text-muted-foreground py-4">Geen wijzigingsverzoeken</p>
              : (
                <div className="space-y-2">
                  {wijzigingsverzoeken.map((verzoek) => (
                    <div
                      key={verzoek.id}
                      onClick={() => setSelectedVerzoek(verzoek)}
                      className="rounded-lg border bg-warning/5 border-warning/30 p-3 cursor-pointer hover:bg-warning/10 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-foreground">{verzoek.titel || 'Wijziging'}</span>
                          {verzoek.klant_naam && (
                            <>
                              <span className="mx-2 text-muted-foreground">•</span>
                              <span className="text-muted-foreground">{verzoek.klant_naam}</span>
                            </>
                          )}
                        </div>
                        <PrioriteitBadge prioriteit={verzoek.prioriteit} />
                      </div>
                      {verzoek.huidige_situatie && (
                        <p className="mt-1 text-sm text-muted-foreground line-clamp-1">{verzoek.huidige_situatie}</p>
                      )}
                    </div>
                  ))}
                </div>
              )
            }
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Welkom, {employeeName}</h1>
        <p className="mt-1 text-base text-muted-foreground">
          Week {weekNumber} – {dateRange}
        </p>
      </div>

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
        {renderPanelContent()}
      </div>

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

      <div>
        <h2 className="mb-6 text-xl font-semibold text-foreground">Mijn aanvragen</h2>
        <MijnAanvragen />
      </div>

      {/* Modals */}
      {selectedProject && (
        <ActiveProjectModal
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
          onOpenInPlanner={() => { setSelectedProject(null); navigate('/?tab=planner'); }}
        />
      )}
      {selectedDeadline && (
        <DeadlineModal
          deadline={selectedDeadline}
          onClose={() => setSelectedDeadline(null)}
          onOpenInPlanner={() => { setSelectedDeadline(null); navigate('/?tab=planner'); }}
        />
      )}
      {selectedReview && (
        <ReviewModal
          review={selectedReview}
          onClose={() => setSelectedReview(null)}
          onOpenInPlanner={() => { setSelectedReview(null); navigate('/?tab=planner'); }}
        />
      )}
      {selectedVerzoek && (
        <WijzigingsverzoekModal
          verzoek={selectedVerzoek}
          onClose={() => setSelectedVerzoek(null)}
          onNieuwVerzoek={() => { setSelectedVerzoek(null); navigate('/wijzigingsverzoek'); }}
        />
      )}
      {selectedAfgerond && (
        <AfgerondModal
          project={selectedAfgerond}
          onClose={() => setSelectedAfgerond(null)}
        />
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function PrioriteitBadge({ prioriteit }: { prioriteit: string }) {
  const config: Record<string, { label: string; cls: string }> = {
    urgent: { label: 'Urgent', cls: 'bg-red-100 text-red-700 border-red-200' },
    hoog: { label: 'Hoog', cls: 'bg-orange-100 text-orange-700 border-orange-200' },
    normaal: { label: 'Normaal', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
    laag: { label: 'Laag', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  };
  const c = config[prioriteit] ?? { label: prioriteit, cls: 'bg-slate-100 text-slate-600 border-slate-200' };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${c.cls}`}>{c.label}</span>
  );
}

function ModalShell({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="relative w-full max-w-lg bg-background rounded-2xl shadow-2xl border border-border pointer-events-auto overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {children}
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
        <p className="text-sm font-medium text-foreground">{value || '—'}</p>
      </div>
    </div>
  );
}

function TextBlock({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="mt-3 pt-3 border-t border-border">
      <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
      <p className="text-sm text-foreground whitespace-pre-line">{value}</p>
    </div>
  );
}

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function fmt(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
}

// ── Modals ────────────────────────────────────────────────────────────────────

function ActiveProjectModal({
  project, onClose, onOpenInPlanner,
}: { project: ActiveProject; onClose: () => void; onOpenInPlanner: () => void }) {
  const statusLabel: Record<string, string> = {
    actief: 'Actief', in_behandeling: 'In behandeling', concept: 'Concept',
    wacht_klant: 'Wacht op klant', afgerond: 'Afgerond',
  };
  const statusColor: Record<string, string> = {
    actief: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    in_behandeling: 'bg-blue-100 text-blue-700 border-blue-200',
    concept: 'bg-slate-100 text-slate-600 border-slate-200',
    wacht_klant: 'bg-amber-100 text-amber-700 border-amber-200',
    afgerond: 'bg-purple-100 text-purple-700 border-purple-200',
  };

  return (
    <ModalShell onClose={onClose}>
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
          <h2 className="mt-2 text-lg font-semibold text-foreground">{project.klant_naam}</h2>
          {project.omschrijving && <p className="mt-1 text-sm text-muted-foreground">{project.omschrijving}</p>}
        </div>
        <button type="button" onClick={onClose} className="shrink-0 p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
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
      <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-muted/30">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted">
          Sluiten
        </button>
        <button type="button" onClick={onOpenInPlanner} className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
          <ExternalLink className="h-3.5 w-3.5" />
          Bekijk in planner
        </button>
      </div>
    </ModalShell>
  );
}

function DeadlineModal({
  deadline, onClose, onOpenInPlanner,
}: { deadline: UpcomingDeadline; onClose: () => void; onOpenInPlanner: () => void }) {
  const severityColor: Record<string, string> = {
    high: 'bg-red-100 text-red-700 border-red-200',
    medium: 'bg-amber-100 text-amber-700 border-amber-200',
    low: 'bg-slate-100 text-slate-600 border-slate-200',
  };
  const severityLabel: Record<string, string> = {
    high: 'Kritiek', medium: 'Binnenkort', low: 'Op tijd',
  };

  return (
    <ModalShell onClose={onClose}>
      <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 border-b border-border">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
              #{deadline.projectnummer}
            </span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${severityColor[deadline.severity]}`}>
              {severityLabel[deadline.severity]}
            </span>
          </div>
          <h2 className="mt-2 text-lg font-semibold text-foreground">{deadline.klant_naam}</h2>
          {deadline.omschrijving && <p className="mt-1 text-sm text-muted-foreground">{deadline.omschrijving}</p>}
        </div>
        <button type="button" onClick={onClose} className="shrink-0 p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="px-6 py-4 space-y-3">
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          <DetailRow icon={CalendarDays} label="Deadline" value={fmt(deadline.deadline)} />
          <DetailRow icon={Clock} label="Dagen resterend" value={deadline.daysUntil <= 0 ? 'Vandaag!' : `${deadline.daysUntil} dag${deadline.daysUntil !== 1 ? 'en' : ''}`} />
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-muted/30">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted">
          Sluiten
        </button>
        <button type="button" onClick={onOpenInPlanner} className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
          <ExternalLink className="h-3.5 w-3.5" />
          Open in planner
        </button>
      </div>
    </ModalShell>
  );
}

function ReviewModal({
  review, onClose, onOpenInPlanner,
}: { review: InterneReview; onClose: () => void; onOpenInPlanner: () => void }) {
  const statusLabel: Record<string, string> = {
    open: 'Open', in_review: 'In review', goedgekeurd: 'Goedgekeurd', afgewezen: 'Afgewezen',
  };
  const statusColor: Record<string, string> = {
    open: 'bg-blue-100 text-blue-700 border-blue-200',
    in_review: 'bg-amber-100 text-amber-700 border-amber-200',
    goedgekeurd: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    afgewezen: 'bg-red-100 text-red-700 border-red-200',
  };

  return (
    <ModalShell onClose={onClose}>
      <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 border-b border-border">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {review.projectnummer && (
              <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                #{review.projectnummer}
              </span>
            )}
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${statusColor[review.status] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
              {statusLabel[review.status] ?? review.status}
            </span>
            <PrioriteitBadge prioriteit={review.prioriteit} />
          </div>
          <h2 className="mt-2 text-lg font-semibold text-foreground">{review.titel}</h2>
          {review.klant_naam && <p className="mt-1 text-sm text-muted-foreground">{review.klant_naam}</p>}
        </div>
        <button type="button" onClick={onClose} className="shrink-0 p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="px-6 py-4 space-y-3">
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          <DetailRow icon={User} label="Reviewer" value={review.reviewer_naam || '—'} />
          <DetailRow icon={CalendarDays} label="Deadline" value={fmt(review.deadline)} />
        </div>
        <TextBlock label="Beschrijving" value={review.beschrijving} />
      </div>
      <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-muted/30">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted">
          Sluiten
        </button>
        <button type="button" onClick={onOpenInPlanner} className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
          <ExternalLink className="h-3.5 w-3.5" />
          Open in planner
        </button>
      </div>
    </ModalShell>
  );
}

function WijzigingsverzoekModal({
  verzoek, onClose, onNieuwVerzoek,
}: { verzoek: Wijzigingsverzoek; onClose: () => void; onNieuwVerzoek: () => void }) {
  const statusLabel: Record<string, string> = {
    ingediend: 'Ingediend', in_behandeling: 'In behandeling',
    goedgekeurd: 'Goedgekeurd', afgewezen: 'Afgewezen',
  };
  const statusColor: Record<string, string> = {
    ingediend: 'bg-blue-100 text-blue-700 border-blue-200',
    in_behandeling: 'bg-amber-100 text-amber-700 border-amber-200',
    goedgekeurd: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    afgewezen: 'bg-red-100 text-red-700 border-red-200',
  };
  const typeLabel: Record<string, string> = {
    scope: 'Scope', deadline: 'Deadline', team: 'Team', budget: 'Budget', anders: 'Anders',
  };

  return (
    <ModalShell onClose={onClose}>
      <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 border-b border-border">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {verzoek.projectnummer && (
              <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                #{verzoek.projectnummer}
              </span>
            )}
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${statusColor[verzoek.status] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
              {statusLabel[verzoek.status] ?? verzoek.status}
            </span>
            <PrioriteitBadge prioriteit={verzoek.prioriteit} />
          </div>
          <h2 className="mt-2 text-lg font-semibold text-foreground">{verzoek.titel}</h2>
          {verzoek.klant_naam && <p className="mt-1 text-sm text-muted-foreground">{verzoek.klant_naam}</p>}
        </div>
        <button type="button" onClick={onClose} className="shrink-0 p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="px-6 py-4 space-y-3">
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          <DetailRow icon={Tag} label="Type" value={typeLabel[verzoek.type] ?? verzoek.type} />
          <DetailRow icon={User} label="Aanvrager" value={verzoek.aanvrager_naam || '—'} />
        </div>
        <TextBlock label="Huidige situatie" value={verzoek.huidige_situatie} />
        <TextBlock label="Gewenste situatie" value={verzoek.gewenste_situatie} />
      </div>
      <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-muted/30">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted">
          Sluiten
        </button>
        <button type="button" onClick={onNieuwVerzoek} className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
          <ArrowRightLeft className="h-3.5 w-3.5" />
          Nieuw verzoek indienen
        </button>
      </div>
    </ModalShell>
  );
}

function AfgerondModal({
  project, onClose,
}: { project: AfgerondProject; onClose: () => void }) {
  return (
    <ModalShell onClose={onClose}>
      <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 border-b border-border">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
              #{project.projectnummer}
            </span>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full border bg-purple-100 text-purple-700 border-purple-200">
              Afgerond
            </span>
          </div>
          <h2 className="mt-2 text-lg font-semibold text-foreground">{project.klant_naam}</h2>
          {project.omschrijving && <p className="mt-1 text-sm text-muted-foreground">{project.omschrijving}</p>}
        </div>
        <button type="button" onClick={onClose} className="shrink-0 p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="px-6 py-4 space-y-3">
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          <DetailRow icon={CalendarDays} label="Deadline" value={fmt(project.deadline)} />
          <DetailRow icon={CheckCircle2} label="Afgerond op" value={fmt(project.afgerond_op)} />
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-muted/30">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted">
          Sluiten
        </button>
      </div>
    </ModalShell>
  );
}
