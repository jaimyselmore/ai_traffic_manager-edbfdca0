import { useState, useRef, useEffect } from 'react';
import { X, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PlannerGrid } from './PlannerGrid';
import { Employee, generateMockTasks, getWeekNumber, formatDateRange } from '@/lib/mockData';

interface FullscreenPlannerProps {
  currentWeekStart: Date;
  employees: Employee[];
  onClose: () => void;
  onWeekSelect: (weekStart: Date) => void;
  initialZoom?: number;
  onZoomChange?: (zoom: number) => void;
}

const zoomLevels = [50, 75, 100, 125, 150];

export function FullscreenPlanner({
  currentWeekStart,
  employees,
  onClose,
  onWeekSelect,
  initialZoom = 100,
  onZoomChange,
}: FullscreenPlannerProps) {
  const [weeksToShow, setWeeksToShow] = useState(1);
  const [plannerZoom, setPlannerZoom] = useState(initialZoom);
  const [isPanning, setIsPanning] = useState(false);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

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

  const handleZoomChange = (newZoom: number) => {
    setPlannerZoom(newZoom);
    onZoomChange?.(newZoom);
  };

  const handleZoomOut = () => {
    const currentIndex = zoomLevels.indexOf(plannerZoom);
    if (currentIndex > 0) {
      handleZoomChange(zoomLevels[currentIndex - 1]);
    }
  };

  const handleZoomIn = () => {
    const currentIndex = zoomLevels.indexOf(plannerZoom);
    if (currentIndex < zoomLevels.length - 1) {
      handleZoomChange(zoomLevels[currentIndex + 1]);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (plannerZoom < 100) {
      setIsPanning(true);
      setStartPan({ x: e.clientX - panPosition.x, y: e.clientY - panPosition.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPanPosition({
        x: e.clientX - startPan.x,
        y: e.clientY - startPan.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  useEffect(() => {
    // Reset pan position when zoom changes
    setPanPosition({ x: 0, y: 0 });
  }, [plannerZoom]);

  // Grid layout based on weeks and zoom
  const getGridClasses = () => {
    if (weeksToShow === 1) return '';
    if (weeksToShow === 2) return 'grid grid-cols-2 gap-6';
    if (weeksToShow === 3) return 'grid grid-cols-3 gap-6';
    if (weeksToShow === 4) {
      // At zoom <= 75, show all 4 in one row; otherwise 2x2
      return plannerZoom <= 75 ? 'grid grid-cols-4 gap-6' : 'grid grid-cols-2 gap-6';
    }
    return '';
  };

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-hidden">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-6 py-4">
        <div className="flex items-center gap-6">
          <h2 className="text-lg font-semibold text-foreground">Planningsoverzicht</h2>
          
          {/* Week count selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Toon aantal weken:</span>
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
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Zoom:</span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleZoomOut}
                disabled={plannerZoom === 50}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Select value={plannerZoom.toString()} onValueChange={(v) => handleZoomChange(parseInt(v))}>
                <SelectTrigger className="w-20">
                  <SelectValue>{plannerZoom}%</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {zoomLevels.map((z) => (
                    <SelectItem key={z} value={z.toString()}>
                      {z}%
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleZoomIn}
                disabled={plannerZoom === 150}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        
        <Button variant="outline" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Pannable/Scrollable Content */}
      <div
        ref={containerRef}
        className="h-[calc(100vh-73px)] overflow-auto"
        style={{
          cursor: plannerZoom < 100 ? (isPanning ? 'grabbing' : 'grab') : 'default',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          className="p-6 origin-top-left transition-transform duration-200"
          style={{
            transform: `scale(${plannerZoom / 100}) translate(${panPosition.x / (plannerZoom / 100)}px, ${panPosition.y / (plannerZoom / 100)}px)`,
            width: plannerZoom < 100 ? `${100 / (plannerZoom / 100)}%` : '100%',
          }}
        >
          {weeksToShow === 1 ? (
            <div
              className="rounded-xl border border-border bg-card p-4 cursor-pointer hover:border-primary transition-colors"
              onClick={() => handleWeekClick(weeks[0].start)}
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold text-foreground">
                  Week {weeks[0].number}
                </h3>
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