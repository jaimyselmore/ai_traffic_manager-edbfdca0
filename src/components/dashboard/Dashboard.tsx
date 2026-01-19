import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Clock, Eye, Bell, FolderOpen, Plus, FileEdit, Users, CalendarOff } from 'lucide-react';
import { HeroSection } from './HeroSection';
import { StatCard } from './StatCard';
import { RequestBlock } from './RequestBlock';
import { NotificationPanel } from './NotificationPanel';
import { getWeekNumber, getWeekStart, formatDateRange } from '@/lib/mockData';
import { useEmployees, useNotifications, type Notification } from '@/lib/data';
import './dashboard-styles.css';

type RequestType = 'project' | 'wijziging' | 'meeting' | 'verlof';
type NotificationType = 'late' | 'upcoming' | 'review' | 'change' | 'active';

interface DashboardProps {
  selectedEmployeeId: string;
  onTabChange?: (tab: 'overzicht' | 'planner' | 'agendas') => void;
}

export function Dashboard({ selectedEmployeeId, onTabChange }: DashboardProps) {
  const navigate = useNavigate();
  const { data: employees = [] } = useEmployees();
  const { data: initialNotifications = [] } = useNotifications();
  
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [openPanel, setOpenPanel] = useState<NotificationType | null>(null);
  
  // Update notifications when data loads
  useState(() => {
    if (initialNotifications.length > 0 && notifications.length === 0) {
      setNotifications(initialNotifications);
    }
  });

  const today = new Date();
  const weekStart = getWeekStart(today);
  const weekNumber = getWeekNumber(today);
  const dateRange = formatDateRange(weekStart);

  const currentEmployee = employees.find(emp => emp.id === selectedEmployeeId);
  const employeeName = currentEmployee?.name.split(' ')[0] || 'Gebruiker';

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
    <>
      {/* HERO SECTION - Nosu style (nu zonder eigen achtergrond, gebruikt parent achtergrond) */}
      <HeroSection
        onTabChange={onTabChange}
      />

      {/* Content op rode achtergrond */}
      <div className="relative space-y-8 px-6 pt-8 pb-12 max-w-7xl mx-auto">
        {/* Welcome + Week Info - Horizontaal naast elkaar */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl md:text-3xl font-semibold text-white">
            Welkom, {employeeName}
          </h2>
          <p className="text-lg text-white/80">
            Week {weekNumber} – {dateRange}
          </p>
        </div>

        <div className="relative z-10">
          {/* STATS SECTION - Nosu style glassmorphism */}
          <section className="gradient-section p-12 rounded-3xl mb-16">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
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
          </section>

          {/* ACTIONS SECTION - Modern cards */}
          <section>
            <h2 className="text-3xl font-bold text-white mb-8">
              Wat wil je doen?
            </h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
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
          </section>
        </div>
      </div>

      {/* Notification Panel - Unchanged */}
      {openPanel && (
        <NotificationPanel
          isOpen={!!openPanel}
          onClose={() => setOpenPanel(null)}
          type={openPanel}
          notifications={getNotificationsForType(openPanel)}
          onMarkDone={handleMarkDone}
        />
      )}
    </>
  );
}
