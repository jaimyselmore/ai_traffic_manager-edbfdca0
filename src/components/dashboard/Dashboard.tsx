import { useState } from 'react';
import { AlertTriangle, Clock, Eye, Bell, FolderOpen, Plus, FileEdit, Users, CalendarOff } from 'lucide-react';
import { StatCard } from './StatCard';
import { RequestBlock } from './RequestBlock';
import { RequestPanel } from './RequestPanel';
import { mockDashboardStats, mockEmployees, getWeekNumber, getWeekStart, formatDateRange } from '@/lib/mockData';

type RequestType = 'project' | 'wijziging' | 'meeting' | 'verlof';

interface DashboardProps {
  selectedEmployeeId: string;
}

export function Dashboard({ selectedEmployeeId }: DashboardProps) {
  const [openPanel, setOpenPanel] = useState<RequestType | null>(null);
  
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
            description="Start een nieuw project met alle benodigde informatie voor het team."
            icon={Plus}
            onClick={() => setOpenPanel('project')}
            variant="primary"
          />
          <RequestBlock
            label="Wijzigingsverzoek"
            description="Vraag een wijziging aan voor een bestaand project of deliverable."
            icon={FileEdit}
            onClick={() => setOpenPanel('wijziging')}
          />
          <RequestBlock
            label="Meeting / Presentatie"
            description="Plan een meeting of presentatie in met collega's of klanten."
            icon={Users}
            onClick={() => setOpenPanel('meeting')}
          />
          <RequestBlock
            label="Ziek / Verlof"
            description="Meld je ziek of vraag verlof aan voor een bepaalde periode."
            icon={CalendarOff}
            onClick={() => setOpenPanel('verlof')}
          />
        </div>
      </div>

      {/* Request Panel */}
      {openPanel && (
        <RequestPanel
          type={openPanel}
          isOpen={true}
          onClose={() => setOpenPanel(null)}
        />
      )}
    </div>
  );
}
