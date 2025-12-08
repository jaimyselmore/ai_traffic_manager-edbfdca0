import { useState, useRef, useEffect, useCallback } from 'react';
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
  const viewportRef = useRef<HTMLDivElement>(null);
  const plannerContentRef = useRef<HTMLDivElement>(null);
  const [computedZoom, setComputedZoom] = useState(initialZoom / 100);

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

  // Auto-fit calculation
  const calculateFit = useCallback(() => {
    if (!viewportRef.current || !plannerContentRef.current) {
      setComputedZoom(plannerZoom / 100);
      return;
    }

    const viewportWidth = viewportRef.current.clientWidth;
    const viewportHeight = viewportRef.current.clientHeight;
    
    // Temporarily reset scale to measure natural size
    plannerContentRef.current.style.transform = 'scale(1)';
    const plannerWidth = plannerContentRef.current.scrollWidth;
    const plannerHeight = plannerContentRef.current.scrollHeight;

    const baseScale = plannerZoom / 100;
    
    // Only apply fit constraint when zooming out (baseScale < 1)
    if (baseScale < 1) {
      const widthRatio = viewportWidth / plannerWidth;
      const heightRatio = viewportHeight / plannerHeight;
      const fitScale = Math.min(widthRatio, heightRatio);
      const finalScale = Math.min(baseScale, fitScale);
      setComputedZoom(Math.max(0.1, finalScale));
    } else {
      setComputedZoom(baseScale);
    }
  }, [plannerZoom]);

  useEffect(() => {
    calculateFit();

    const handleResize = () => calculateFit();
    window.addEventListener('resize', handleResize);
    
    const resizeObserver = new ResizeObserver(() => calculateFit());
    if (viewportRef.current) {
      resizeObserver.observe(viewportRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
    };
  }, [calculateFit]);

  useEffect(() => {
    const timer = setTimeout(calculateFit, 50);
    return () => clearTimeout(timer);
  }, [plannerZoom, weeksToShow, calculateFit]);

  // Grid layout based on weeks and zoom
  const getGridClasses = () => {
    if (weeksToShow === 1) return '';
    if (weeksToShow === 2) return 'grid grid-cols-2 gap-6';
    if (weeksToShow === 3) return 'grid grid-cols-3 gap-6';
    if (weeksToShow === 4) {
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

      {/* Viewport for auto-fit */}
      <div
        ref={viewportRef}
        className="w-full h-[calc(100vh-73px)] overflow-hidden"
      >
        <div
          ref={plannerContentRef}
          className="p-6 origin-top-left inline-block transition-transform duration-200"
          style={{ transform: `scale(${computedZoom})` }}
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
