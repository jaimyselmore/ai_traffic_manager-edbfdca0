import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Clock, Eye, Bell, FolderOpen, Plus, FileEdit, Users, CalendarOff } from 'lucide-react';
import { StatCard } from './StatCard';
import { RequestBlock } from './RequestBlock';
import { mockDashboardStats, mockEmployees, getWeekNumber, getWeekStart, formatDateRange } from '@/lib/mockData';

type RequestType = 'project' | 'wijziging' | 'meeting' | 'verlof';

interface DashboardProps {
  selectedEmployeeId: string;
}

export function Dashboard({ selectedEmployeeId }: DashboardProps) {
  const navigate = useNavigate();
  
  const today = new Date();
  const weekStart = getWeekStart(today);
  const weekNumber = getWeekNumber(today);
  const dateRange = formatDateRange(weekStart);

  const currentEmployee = mockEmployees.find(emp => emp.id === selectedEmployeeId);
  const employeeName = currentEmployee?.name.split(' ')[0] || 'Gebruiker';

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
          value={mockDashboardStats.overdue}
          icon={AlertTriangle}
          variant="danger"
        />
        <StatCard
          title="Aankomende deadlines"
          value={mockDashboardStats.upcoming}
          icon={Clock}
          variant="warning"
        />
        <StatCard
          title="Reviews"
          value={mockDashboardStats.reviews}
          icon={Eye}
          variant="info"
        />
        <StatCard
          title="Gemiste wijzigingen"
          value={mockDashboardStats.changes}
          icon={Bell}
          variant="default"
        />
        <StatCard
          title="Actieve projecten"
          value={mockDashboardStats.activeProjects}
          icon={FolderOpen}
          variant="success"
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
    </div>
  );
}
