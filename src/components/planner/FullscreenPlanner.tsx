import { useState, useRef, useEffect } from 'react';
import { X, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PlannerGrid } from './PlannerGrid';
import { Employee, Task, generateMockTasks, getWeekNumber, formatDateRange } from '@/lib/mockData';

interface FullscreenPlannerProps {
  currentWeekStart: Date;
  employees: Employee[];
  onClose: () => void;
  onWeekSelect: (weekStart: Date) => void;
}

const zoomLevels = [100, 75, 50, 25];

export function FullscreenPlanner({
  currentWeekStart,
  employees,
  onClose,
  onWeekSelect,
}: FullscreenPlannerProps) {
  const [weeksToShow, setWeeksToShow] = useState(1);
  const [zoom, setZoom] = useState(100);
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

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom < 100) {
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
  }, [zoom]);

  // Grid layout: 4 weeks = 2x2, otherwise single row
  const getGridStyle = () => {
    if (weeksToShow === 4) {
      return { gridTemplateColumns: 'repeat(2, 1fr)' };
    }
    return { gridTemplateColumns: `repeat(${weeksToShow}, 1fr)` };
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
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  const currentIndex = zoomLevels.indexOf(zoom);
                  if (currentIndex < zoomLevels.length - 1) {
                    setZoom(zoomLevels[currentIndex + 1]);
                  }
                }}
                disabled={zoom === 25}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="w-12 text-center text-sm font-medium">{zoom}%</span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  const currentIndex = zoomLevels.indexOf(zoom);
                  if (currentIndex > 0) {
                    setZoom(zoomLevels[currentIndex - 1]);
                  }
                }}
                disabled={zoom === 100}
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
          cursor: zoom < 100 ? (isPanning ? 'grabbing' : 'grab') : 'default',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          className="p-6 origin-top-left transition-transform duration-200"
          style={{
            transform: `scale(${zoom / 100}) translate(${panPosition.x / (zoom / 100)}px, ${panPosition.y / (zoom / 100)}px)`,
            width: zoom < 100 ? `${100 / (zoom / 100)}%` : '100%',
          }}
        >
          <div className="grid gap-6" style={getGridStyle()}>
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
        </div>
      </div>
    </div>
  );
}
