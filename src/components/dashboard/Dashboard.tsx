import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Clock, Eye, Bell, FolderOpen, Plus, FileEdit, Users, CalendarOff, Archive } from 'lucide-react';
import { StatCard } from './StatCard';
import { RequestBlock } from './RequestBlock';
import { NotificationPanel, type Notification as PanelNotification, type NotificationType } from './NotificationPanel';
import { MijnAanvragen } from './MijnAanvragen';
import { WachtOpGoedkeuring, getWachtKlantCount } from './WachtOpGoedkeuring';
import { getWeekNumber, getWeekStart, formatDateRange } from '@/lib/helpers/dateHelpers';
import { useNotifications, useUpcomingDeadlines, useActiveProjects, useInterneReviews, useWijzigingsverzoeken, useAfgerondeProjecten } from '@/lib/data';
import { useAuth } from '@/contexts/AuthContext';

interface DashboardProps {
  selectedEmployeeId: string;
}

export function Dashboard({ selectedEmployeeId: _selectedEmployeeId }: DashboardProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: initialNotifications = [] } = useNotifications();
  const { data: upcomingDeadlines = [] } = useUpcomingDeadlines();
  const { data: activeProjects = [] } = useActiveProjects();
  const { data: interneReviews = [] } = useInterneReviews();
  const { data: wijzigingsverzoeken = [] } = useWijzigingsverzoeken();
  const { data: afgerondeProjecten = [] } = useAfgerondeProjecten();

  // Convert data layer notifications to panel notifications
  const convertNotifications = (notifs: typeof initialNotifications): PanelNotification[] =>
    notifs.map(n => ({
      id: n.id,
      type: (n.type as NotificationType) || 'active',
      client: n.client || n.clientName || '',
      project: n.project || n.projectNumber || '',
      workType: n.workType || '',
      employee: n.employee || '',
      deadline: n.deadline || '',
      severity: n.severity,
      isDone: n.isDone,
    }));

  const [notifications, setNotifications] = useState<PanelNotification[]>([]);
  const [openPanel, setOpenPanel] = useState<NotificationType | null>(null);
  const [wachtKlantCount, setWachtKlantCount] = useState(0);
  const [showWachtOpGoedkeuring, setShowWachtOpGoedkeuring] = useState(false);
  const [showAfgerondeProjecten, setShowAfgerondeProjecten] = useState(false);

  // Update notifications when data loads
  useState(() => {
    if (initialNotifications.length > 0 && notifications.length === 0) {
      setNotifications(convertNotifications(initialNotifications));
    }
  });

  // Load wacht_klant count
  useEffect(() => {
    getWachtKlantCount().then(setWachtKlantCount);
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
  // Reviews en wijzigingsverzoeken komen nu uit de nieuwe tabellen
  const reviewsCount = interneReviews.length;
  const changesCount = wijzigingsverzoeken.length;

  // Statistieken met prioriteit - hoogste eerst (links)
  const statsConfig = useMemo(() => {
    const stats = [
      {
        id: 'wacht_klant',
        title: 'Wacht op goedkeuring',
        value: wachtKlantCount,
        icon: CheckCircle2,
        variant: wachtKlantCount > 0 ? 'warning' as const : 'default' as const,
        priority: wachtKlantCount > 0 ? 5 : 0, // Hoogste prioriteit als er items zijn
        onClick: () => setShowWachtOpGoedkeuring(!showWachtOpGoedkeuring),
      },
      {
        id: 'deadlines',
        title: 'Aankomende deadlines',
        value: upcomingDeadlinesCount,
        icon: Clock,
        variant: upcomingDeadlinesCount > 3 ? 'danger' as const : upcomingDeadlinesCount > 0 ? 'warning' as const : 'default' as const,
        priority: upcomingDeadlinesCount > 3 ? 4 : upcomingDeadlinesCount > 0 ? 3 : 0,
        onClick: () => setOpenPanel('upcoming'),
      },
      {
        id: 'reviews',
        title: 'Interne reviews',
        value: reviewsCount,
        icon: Eye,
        variant: reviewsCount > 0 ? 'info' as const : 'default' as const,
        priority: reviewsCount > 0 ? 2 : 0,
        onClick: () => setOpenPanel('review'),
      },
      {
        id: 'changes',
        title: 'Wijzigingsverzoeken',
        value: changesCount,
        icon: Bell,
        variant: changesCount > 0 ? 'warning' as const : 'default' as const,
        priority: changesCount > 0 ? 2 : 0,
        onClick: () => setOpenPanel('change'),
      },
      {
        id: 'active',
        title: 'Actieve projecten',
        value: activeProjectsCount,
        icon: FolderOpen,
        variant: 'success' as const,
        priority: 1, // Altijd laagste prioriteit (gewoon informatief)
        onClick: () => setOpenPanel('active'),
      },
      {
        id: 'afgerond',
        title: 'Afgeronde projecten',
        value: afgerondeProjectenCount,
        icon: Archive,
        variant: 'default' as const,
        priority: 0, // Laagste prioriteit - archief/historie
        onClick: () => setShowAfgerondeProjecten(!showAfgerondeProjecten),
      },
    ];

    // Sorteer op prioriteit (hoogste eerst), behoud volgorde bij gelijke prioriteit
    return stats.sort((a, b) => b.priority - a.priority);
  }, [wachtKlantCount, upcomingDeadlinesCount, reviewsCount, changesCount, activeProjectsCount, afgerondeProjectenCount, showWachtOpGoedkeuring, showAfgerondeProjecten]);

  const handleMarkDone = (id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, isDone: true } : n)
    );
  };

  const getNotificationsForType = (type: NotificationType) => {
    // Voor upcoming en active, converteer echte data naar panel notifications
    if (type === 'upcoming') {
      return upcomingDeadlines.map(d => ({
        id: d.id,
        type: 'upcoming' as NotificationType,
        client: d.klant_naam,
        project: d.projectnummer,
        workType: d.omschrijving,
        employee: '',
        deadline: d.deadline,
        severity: d.severity,
        isDone: false,
      }));
    }
    if (type === 'active') {
      return activeProjects.map(p => ({
        id: p.id,
        type: 'active' as NotificationType,
        client: p.klant_naam,
        project: p.projectnummer,
        workType: p.omschrijving,
        employee: '',
        deadline: p.deadline,
        severity: 'low' as const,
        isDone: false,
      }));
    }
    return notifications.filter(n => n.type === type);
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {statsConfig.map((stat) => (
          <StatCard
            key={stat.id}
            title={stat.title}
            value={stat.value}
            icon={stat.icon}
            variant={stat.variant}
            onClick={stat.onClick}
          />
        ))}
      </div>

      {/* Wacht op Goedkeuring Panel */}
      {showWachtOpGoedkeuring && wachtKlantCount > 0 && (
        <div>
          <h2 className="mb-4 text-xl font-semibold text-foreground">Wacht op goedkeuring</h2>
          <WachtOpGoedkeuring />
        </div>
      )}

      {/* Afgeronde Projecten Panel */}
      {showAfgerondeProjecten && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">Afgeronde projecten</h2>
            <button
              onClick={() => setShowAfgerondeProjecten(false)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Sluiten
            </button>
          </div>
          {afgerondeProjecten.length === 0 ? (
            <div className="rounded-lg border bg-card p-6 text-center text-muted-foreground">
              Geen afgeronde projecten
            </div>
          ) : (
            <div className="space-y-2">
              {afgerondeProjecten.map((project) => (
                <div
                  key={project.id}
                  className="rounded-lg border bg-slate-50 p-4 opacity-75"
                >
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
      )}

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

      {/* Mijn Aanvragen */}
      <div>
        <h2 className="mb-6 text-xl font-semibold text-foreground">Mijn aanvragen</h2>
        <MijnAanvragen />
      </div>

      {/* Notification Panel */}
      {openPanel && (
        <NotificationPanel
          isOpen={!!openPanel}
          onClose={() => setOpenPanel(null)}
          type={openPanel}
          notifications={getNotificationsForType(openPanel)}
          onMarkDone={handleMarkDone}
        />
      )}
    </div>
  );
}
