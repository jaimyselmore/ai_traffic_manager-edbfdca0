import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Clock, Eye, Bell, FolderOpen, Plus, FileEdit, Users, CalendarOff } from 'lucide-react';
import { StatCard } from './StatCard';
import { RequestBlock } from './RequestBlock';
import { NotificationPanel, Notification, NotificationType } from './NotificationPanel';
import { mockEmployees, getWeekNumber, getWeekStart, formatDateRange } from '@/lib/mockData';

type RequestType = 'project' | 'wijziging' | 'meeting' | 'verlof';

interface DashboardProps {
  selectedEmployeeId: string;
}

// Mock notifications data
const initialNotifications: Notification[] = [
  // Te laat (late)
  { id: '1', type: 'late', client: 'Acme Corp', project: 'Brand Refresh 2025', workType: 'Conceptontwikkeling', employee: 'Jan de Vries', deadline: '2 dec 2025', severity: 'high', isDone: false },
  { id: '2', type: 'late', client: 'TechStart BV', project: 'Website Redesign', workType: 'Productie', employee: 'Lisa Bakker', deadline: '28 nov 2025', severity: 'high', isDone: false },
  { id: '3', type: 'late', client: 'GreenLeaf', project: 'Social Campaign', workType: 'Content', employee: 'Peter Smit', deadline: '1 dec 2025', severity: 'medium', isDone: false },
  
  // Aankomende deadlines (upcoming)
  { id: '4', type: 'upcoming', client: 'FinanceHub', project: 'Annual Report Design', workType: 'Productie', employee: 'Anna Jansen', deadline: '12 dec 2025', severity: 'medium', isDone: false },
  { id: '5', type: 'upcoming', client: 'SportMax', project: 'Event Branding', workType: 'Conceptuitwerking', employee: 'Mark de Boer', deadline: '15 dec 2025', severity: 'low', isDone: false },
  { id: '6', type: 'upcoming', client: 'Acme Corp', project: 'Q1 Campaign', workType: 'Conceptontwikkeling', employee: 'Jan de Vries', deadline: '18 dec 2025', severity: 'medium', isDone: false },
  { id: '7', type: 'upcoming', client: 'TechStart BV', project: 'App Launch', workType: 'Video', employee: 'Lisa Bakker', deadline: '20 dec 2025', severity: 'low', isDone: false },
  { id: '8', type: 'upcoming', client: 'GreenLeaf', project: 'Product Packaging', workType: 'Productie', employee: 'Peter Smit', deadline: '22 dec 2025', severity: 'low', isDone: false },
  
  // Reviews
  { id: '9', type: 'review', client: 'FinanceHub', project: 'Brand Guidelines', workType: 'Interne review', employee: 'Anna Jansen', deadline: '10 dec 2025', severity: 'medium', isDone: false },
  { id: '10', type: 'review', client: 'SportMax', project: 'Logo Varianten', workType: 'Interne review', employee: 'Mark de Boer', deadline: '11 dec 2025', severity: 'low', isDone: false },
  
  // Gemiste wijzigingen (change)
  { id: '11', type: 'change', client: 'Acme Corp', project: 'Brand Refresh 2025', workType: 'Wijziging', employee: 'Jan de Vries', deadline: '5 dec 2025', severity: 'medium', isDone: false },
  { id: '12', type: 'change', client: 'TechStart BV', project: 'Website Redesign', workType: 'Scope wijziging', employee: 'Lisa Bakker', deadline: '6 dec 2025', severity: 'low', isDone: false },
  { id: '13', type: 'change', client: 'GreenLeaf', project: 'Social Campaign', workType: 'Team wijziging', employee: 'Peter Smit', deadline: '7 dec 2025', severity: 'low', isDone: false },
  { id: '14', type: 'change', client: 'FinanceHub', project: 'Annual Report', workType: 'Deadline wijziging', employee: 'Anna Jansen', deadline: '8 dec 2025', severity: 'medium', isDone: false },
  
  // Actieve projecten (active)
  { id: '15', type: 'active', client: 'Acme Corp', project: 'Brand Refresh 2025', workType: 'Campagne', employee: 'Jan de Vries', deadline: '31 jan 2026', severity: 'low', isDone: false },
  { id: '16', type: 'active', client: 'TechStart BV', project: 'Website Redesign', workType: 'Website', employee: 'Lisa Bakker', deadline: '15 feb 2026', severity: 'low', isDone: false },
  { id: '17', type: 'active', client: 'GreenLeaf', project: 'Social Campaign Q1', workType: 'Content', employee: 'Peter Smit', deadline: '28 feb 2026', severity: 'low', isDone: false },
  { id: '18', type: 'active', client: 'FinanceHub', project: 'Annual Report 2025', workType: 'Branding', employee: 'Anna Jansen', deadline: '20 mrt 2026', severity: 'low', isDone: false },
  { id: '19', type: 'active', client: 'SportMax', project: 'Event Branding', workType: 'Event', employee: 'Mark de Boer', deadline: '10 apr 2026', severity: 'low', isDone: false },
  { id: '20', type: 'active', client: 'MediCare', project: 'Recruitment Video', workType: 'Video', employee: 'Lisa Bakker', deadline: '30 apr 2026', severity: 'low', isDone: false },
  { id: '21', type: 'active', client: 'FoodFirst', project: 'Packaging Redesign', workType: 'Branding', employee: 'Jan de Vries', deadline: '15 mei 2026', severity: 'low', isDone: false },
  { id: '22', type: 'active', client: 'TravelWise', project: 'App Campaign', workType: 'Campagne', employee: 'Peter Smit', deadline: '1 jun 2026', severity: 'low', isDone: false },
  { id: '23', type: 'active', client: 'EduLearn', project: 'Platform Branding', workType: 'Website', employee: 'Anna Jansen', deadline: '20 jun 2026', severity: 'low', isDone: false },
  { id: '24', type: 'active', client: 'HomeStyle', project: 'Product Launch', workType: 'Content', employee: 'Mark de Boer', deadline: '15 jul 2026', severity: 'low', isDone: false },
  { id: '25', type: 'active', client: 'AutoDrive', project: 'Brand Identity', workType: 'Branding', employee: 'Jan de Vries', deadline: '30 jul 2026', severity: 'low', isDone: false },
  { id: '26', type: 'active', client: 'PetCare Plus', project: 'Social Strategy', workType: 'Content', employee: 'Lisa Bakker', deadline: '15 aug 2026', severity: 'low', isDone: false },
];

export function Dashboard({ selectedEmployeeId }: DashboardProps) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [openPanel, setOpenPanel] = useState<NotificationType | null>(null);
  
  const today = new Date();
  const weekStart = getWeekStart(today);
  const weekNumber = getWeekNumber(today);
  const dateRange = formatDateRange(weekStart);

  const currentEmployee = mockEmployees.find(emp => emp.id === selectedEmployeeId);
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
    <div className="space-y-8">
      {/* Welcome Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          Welkom, {employeeName}
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
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
        <h2 className="mb-4 text-lg font-semibold text-foreground">Nieuwe aanvraag</h2>
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
