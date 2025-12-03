import { useState } from 'react';
import { AlertTriangle, Clock, Eye, Bell, FolderOpen, Plus, FileEdit, Users, CalendarOff } from 'lucide-react';
import { StatCard } from './StatCard';
import { RequestButton } from './RequestButton';
import { RequestPanel } from './RequestPanel';
import { mockDashboardStats, getWeekNumber, getWeekStart, formatDateRange } from '@/lib/mockData';

type RequestType = 'project' | 'wijziging' | 'meeting' | 'verlof';

export function Dashboard() {
  const [openPanel, setOpenPanel] = useState<RequestType | null>(null);
  
  const today = new Date();
  const weekStart = getWeekStart(today);
  const weekNumber = getWeekNumber(today);
  const dateRange = formatDateRange(weekStart);

  return (
    <div className="space-y-8">
      {/* Week Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Week {weekNumber} – {dateRange}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Welkom terug! Hier is je overzicht van deze week.
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

      {/* Request Buttons */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-foreground">Nieuwe aanvraag</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <RequestButton
            label="Nieuw project"
            icon={Plus}
            onClick={() => setOpenPanel('project')}
            variant="primary"
          />
          <RequestButton
            label="Wijzigingsverzoek"
            icon={FileEdit}
            onClick={() => setOpenPanel('wijziging')}
          />
          <RequestButton
            label="Meeting / Presentatie"
            icon={Users}
            onClick={() => setOpenPanel('meeting')}
          />
          <RequestButton
            label="Ziek / Verlof"
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
