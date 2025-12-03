import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PlannerGrid } from './PlannerGrid';
import { Employee, Task, generateMockTasks, getWeekNumber, formatDateRange } from '@/lib/mockData';

interface FullscreenPlannerProps {
  currentWeekStart: Date;
  employees: Employee[];
  onClose: () => void;
  onWeekSelect: (weekStart: Date) => void;
}

export function FullscreenPlanner({
  currentWeekStart,
  employees,
  onClose,
  onWeekSelect,
}: FullscreenPlannerProps) {
  const [weeksToShow, setWeeksToShow] = useState(3);

  const weeks = Array.from({ length: weeksToShow }, (_, i) => {
    const weekStart = new Date(currentWeekStart);
    weekStart.setDate(weekStart.getDate() + i * 7);
    return {
      start: weekStart,
      number: getWeekNumber(weekStart),
      dateRange: formatDateRange(weekStart),
      tasks: generateMockTasks(weekStart),
    };
  });

  const handleWeekClick = (weekStart: Date) => {
    onWeekSelect(weekStart);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-6 py-4">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-foreground">Planningsoverzicht</h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Toon aantal weken:</span>
            {[1, 3, 4, 6].map((num) => (
              <Button
                key={num}
                variant={weeksToShow === num ? 'default' : 'outline'}
                size="sm"
                onClick={() => setWeeksToShow(num)}
              >
                {num}
              </Button>
            ))}
          </div>
        </div>
        <Button variant="outline" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Weeks Grid */}
      <div className="p-6">
        <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${Math.min(weeksToShow, 3)}, 1fr)` }}>
          {weeks.map((week) => (
            <div
              key={week.start.toISOString()}
              className="rounded-xl border border-border bg-card p-4 cursor-pointer hover:border-primary transition-colors"
              onClick={() => handleWeekClick(week.start)}
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold text-foreground">
                  Week {week.number}
                </h3>
                <span className="text-sm text-muted-foreground">{week.dateRange}</span>
              </div>
              <PlannerGrid
                weekStart={week.start}
                employees={employees}
                tasks={week.tasks}
                compact
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
