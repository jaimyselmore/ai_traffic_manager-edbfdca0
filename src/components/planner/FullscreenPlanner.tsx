import { useState } from 'react';
import { X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { PlannerGrid } from './PlannerGrid';
import type { Employee } from '@/lib/data/types';
import type { Task } from '@/hooks/use-tasks';
import { getWeekNumber, getWeekStart, formatDateRange } from '@/lib/helpers/dateHelpers';

interface FullscreenPlannerProps {
  currentWeekStart: Date;
  employees: Employee[];
  tasks: Task[];
  onClose: () => void;
  onWeekSelect: (weekStart: Date) => void;
  initialZoom?: number;
  onZoomChange?: (zoom: number) => void;
}

const zoomLevels = [50, 75, 100, 125, 150];

export function FullscreenPlanner({
  currentWeekStart,
  employees,
  tasks,
  onClose,
  onWeekSelect,
  initialZoom = 100,
  onZoomChange,
}: FullscreenPlannerProps) {
  const [weeksToShow, setWeeksToShow] = useState(1);
  const [plannerZoom, setPlannerZoom] = useState(initialZoom);

  const weeks = Array.from({ length: weeksToShow }, (_, i) => {
    const weekStart = new Date(currentWeekStart);
    weekStart.setDate(weekStart.getDate() + i * 7);
    return {
      start: weekStart,
      number: getWeekNumber(weekStart),
      dateRange: formatDateRange(weekStart),
      tasks: tasks,
    };
  });

  const handleZoomChange = (newZoom: number) => {
    setPlannerZoom(newZoom);
    onZoomChange?.(newZoom);
  };

  const handleZoomOut = () => {
    const currentIndex = zoomLevels.indexOf(plannerZoom);
    if (currentIndex > 0) handleZoomChange(zoomLevels[currentIndex - 1]);
  };

  const handleZoomIn = () => {
    const currentIndex = zoomLevels.indexOf(plannerZoom);
    if (currentIndex < zoomLevels.length - 1) handleZoomChange(zoomLevels[currentIndex + 1]);
  };

  const getGridClasses = () => {
    if (weeksToShow === 1) return '';
    if (weeksToShow === 2) return 'grid grid-cols-2 gap-6';
    if (weeksToShow === 3) return 'grid grid-cols-3 gap-6';
    if (weeksToShow === 4) return plannerZoom <= 75 ? 'grid grid-cols-4 gap-6' : 'grid grid-cols-2 gap-6';
    return '';
  };

  const currentWeekNumber = getWeekNumber(getWeekStart(new Date()));

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-none flex items-center justify-between border-b border-border bg-card px-6 py-4">
        <div className="flex items-center gap-6">
          <h2 className="text-lg font-semibold text-foreground">Planningsoverzicht</h2>

          {/* Week navigation arrows + calendar popover */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                const prev = new Date(currentWeekStart);
                prev.setDate(prev.getDate() - 7);
                onWeekSelect(prev);
              }}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" className="h-8 px-2 min-w-[100px]">
                  <CalendarDays className="h-4 w-4 mr-1" />
                  <span className="text-sm font-medium">
                    {getWeekNumber(currentWeekStart) === currentWeekNumber
                      ? 'Huidige week'
                      : `Week ${getWeekNumber(currentWeekStart)}`}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                <div className="p-2 border-b">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-center text-sm"
                    onClick={() => onWeekSelect(getWeekStart(new Date()))}
                  >
                    Ga naar huidige week
                  </Button>
                </div>
                <Calendar
                  mode="single"
                  selected={currentWeekStart}
                  onSelect={(date) => {
                    if (date) onWeekSelect(getWeekStart(date));
                  }}
                  initialFocus
                  weekStartsOn={1}
                />
              </PopoverContent>
            </Popover>

            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                const next = new Date(currentWeekStart);
                next.setDate(next.getDate() + 7);
                onWeekSelect(next);
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Week count selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Weken:</span>
            {[1, 2, 3, 4].map((num) => (
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

          {/* Zoom control */}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleZoomOut} disabled={plannerZoom === 50}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Select value={plannerZoom.toString()} onValueChange={(v) => handleZoomChange(parseInt(v))}>
              <SelectTrigger className="w-20">
                <SelectValue>{plannerZoom}%</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {zoomLevels.map((z) => (
                  <SelectItem key={z} value={z.toString()}>{z}%</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleZoomIn} disabled={plannerZoom === 150}>
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Button variant="outline" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Scrollable viewport — PlannerGrid handles horizontal scroll; this handles vertical */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6" style={{ zoom: plannerZoom / 100 }}>
          {weeksToShow === 1 ? (
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold text-foreground">Week {weeks[0].number}</h3>
                <span className="text-sm text-muted-foreground">{weeks[0].dateRange}</span>
              </div>
              <PlannerGrid
                weekStart={weeks[0].start}
                employees={employees}
                tasks={weeks[0].tasks}
              />
            </div>
          ) : (
            <div className={getGridClasses()}>
              {weeks.map((week) => (
                <div
                  key={week.start.toISOString()}
                  className="rounded-xl border border-border bg-card p-4"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-semibold text-foreground">Week {week.number}</h3>
                    <span className="text-sm text-muted-foreground">{week.dateRange}</span>
                  </div>
                  <PlannerGrid
                    weekStart={week.start}
                    employees={employees}
                    tasks={week.tasks}
                    compact={weeksToShow > 1}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
