import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Clock, Eye, Bell, FolderOpen, Plus, FileEdit, Users, CalendarOff } from 'lucide-react';
import { StatCard } from './StatCard';
import { RequestBlock } from './RequestBlock';
import { NotificationPanel, type Notification as PanelNotification, type NotificationType } from './NotificationPanel';
import { getWeekNumber, getWeekStart, formatDateRange } from '@/lib/helpers/dateHelpers';
import { useNotifications } from '@/lib/data';
import { useAuth } from '@/contexts/AuthContext';

interface DashboardProps {
  selectedEmployeeId: string;
}

export function Dashboard({ selectedEmployeeId }: DashboardProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: initialNotifications = [] } = useNotifications();

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

  // Update notifications when data loads
  useState(() => {
    if (initialNotifications.length > 0 && notifications.length === 0) {
      setNotifications(convertNotifications(initialNotifications));
    }
  });

  const today = new Date();
  const weekStart = getWeekStart(today);
  const weekNumber = getWeekNumber(today);
  const dateRange = formatDateRange(weekStart);

  // Gebruik de naam van de ingelogde gebruiker
  const employeeName = user?.naam?.split(' ')[0] || 'Gebruiker';

  // Calculate counts per type (only open items)
  const getCount = (type: NotificationType) =>
    notifications.filter(n => n.type === type && !n.isDone).length;

  const handleMarkDone = (id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, isDone: true } : n)
    );
  };

  const getNotificationsForType = (type: NotificationType) =>
    notifications.filter(n => n.type === type);

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

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          title="Te laat"
          value={getCount('late')}
          icon={AlertTriangle}
          variant="danger"
          onClick={() => setOpenPanel('late')}
        />
        <StatCard
          title="Aankomende deadlines"
          value={getCount('upcoming')}
          icon={Clock}
          variant="warning"
          onClick={() => setOpenPanel('upcoming')}
        />
        <StatCard
          title="Reviews"
          value={getCount('review')}
          icon={Eye}
          variant="info"
          onClick={() => setOpenPanel('review')}
        />
        <StatCard
          title="Gemiste wijzigingen"
          value={getCount('change')}
          icon={Bell}
          variant="default"
          onClick={() => setOpenPanel('change')}
        />
        <StatCard
          title="Actieve projecten"
          value={getCount('active')}
          icon={FolderOpen}
          variant="success"
          onClick={() => setOpenPanel('active')}
        />
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
