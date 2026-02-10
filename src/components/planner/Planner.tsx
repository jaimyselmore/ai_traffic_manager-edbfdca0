import { useState, useMemo, useEffect } from 'react';
import { Maximize2, Download, ZoomIn, ZoomOut, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

import { TaskLegend } from './TaskLegend';
import { PlannerGrid } from './PlannerGrid';
import { FullscreenPlanner } from './FullscreenPlanner';
import { getWeekStart, getWeekNumber, formatDateRange } from '@/lib/helpers/dateHelpers';
import { useEmployees } from '@/hooks/use-employees';
import { useClients } from '@/hooks/use-clients';
import { useTasks, Task } from '@/hooks/use-tasks';
import { toast } from '@/hooks/use-toast';
import { exportToCSV, exportToPDF } from '@/lib/export/planningExport';

const STORAGE_KEY = 'planner-visible-employees';

const zoomLevels = [50, 75, 100, 125, 150];

export function Planner() {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getWeekStart(new Date()));
  const currentWeekNumber = getWeekNumber(getWeekStart(new Date())); // The actual current week
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [plannerZoom, setPlannerZoom] = useState<number>(100);

  // Visible employees - stored in localStorage
  const [visibleEmployeeIds, setVisibleEmployeeIds] = useState<string[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  });

  // Fetch data from Supabase
  const { data: employees = [], isLoading: isLoadingEmployees } = useEmployees();
  const { data: clients = [], isLoading: isLoadingClients } = useClients();
  const { data: tasksFromDb = [], isLoading: isLoadingTasks } = useTasks(currentWeekStart);

  // Save visible employees to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(visibleEmployeeIds));
  }, [visibleEmployeeIds]);

  // If no employees selected yet and employees loaded, show all by default
  useEffect(() => {
    if (employees.length > 0 && visibleEmployeeIds.length === 0) {
      setVisibleEmployeeIds(employees.map(e => e.id));
    }
  }, [employees]);

  const weekNumber = getWeekNumber(currentWeekStart);
  const dateRange = formatDateRange(currentWeekStart);

  const tasks = useMemo(() => tasksFromDb, [tasksFromDb]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Filter by visible employees
      if (!visibleEmployeeIds.includes(task.employeeId)) return false;
      if (selectedClient !== 'all' && task.clientName !== selectedClient) return false;
      return true;
    });
  }, [tasks, visibleEmployeeIds, selectedClient]);

  // Voor de grid: gebruik alleen geselecteerde employees
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => visibleEmployeeIds.includes(emp.id));
  }, [employees, visibleEmployeeIds]);

  // Toggle employee visibility
  const toggleEmployee = (employeeId: string) => {
    setVisibleEmployeeIds(prev => {
      if (prev.includes(employeeId)) {
        // Don't allow deselecting if it's the last one
        if (prev.length === 1) return prev;
        return prev.filter(id => id !== employeeId);
      }
      return [...prev, employeeId];
    });
  };

  // Select all employees
  const selectAllEmployees = () => {
    setVisibleEmployeeIds(employees.map(e => e.id));
  };

  const handleDownloadCSV = () => {
    try {
      exportToCSV(filteredTasks, filteredEmployees, currentWeekStart, weekNumber);
      toast({
        title: 'Export geslaagd',
        description: 'CSV is gedownload.',
      });
    } catch (error) {
      toast({
        title: 'Export mislukt',
        description: 'Er is een fout opgetreden bij het exporteren.',
        variant: 'destructive',
      });
    }
  };

  const handleDownloadPDF = () => {
    try {
      exportToPDF(filteredTasks, filteredEmployees, currentWeekStart, weekNumber, dateRange);
      toast({
        title: 'PDF geopend',
        description: 'Print dialoog wordt geopend...',
      });
    } catch (error) {
      toast({
        title: 'Export mislukt',
        description: 'Er is een fout opgetreden bij het genereren van de PDF.',
        variant: 'destructive',
      });
    }
  };

  const handleZoomOut = () => {
    const currentIndex = zoomLevels.indexOf(plannerZoom);
    if (currentIndex > 0) {
      setPlannerZoom(zoomLevels[currentIndex - 1]);
    }
  };

  const handleZoomIn = () => {
    const currentIndex = zoomLevels.indexOf(plannerZoom);
    if (currentIndex < zoomLevels.length - 1) {
      setPlannerZoom(zoomLevels[currentIndex + 1]);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header with controls on same line */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Planner</h1>
          <p className="mt-1 text-base text-muted-foreground">
            Week {weekNumber} – {dateRange}
          </p>
        </div>

        {/* Zoom, Download, Vergroot planner - right side, responsive */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 self-center">
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
            <Select value={plannerZoom.toString()} onValueChange={(v) => setPlannerZoom(parseInt(v))}>
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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                <Download className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Download</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={handleDownloadPDF}>
                Deze week als PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownloadCSV}>
                Deze week als CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="sm" className="h-9" onClick={() => setIsFullscreen(true)}>
            <Maximize2 className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Vergroot planner</span>
          </Button>
        </div>
      </div>

      {/* Filter card left + Legend right */}
      <div className="mt-4 flex items-start gap-8">
        {/* Left: Filter card */}
        <div className="rounded-xl border border-border bg-card px-4 py-4 shadow-sm flex flex-col gap-3">
          <Select 
            value={weekNumber.toString()} 
            onValueChange={(v) => {
              const targetWeek = parseInt(v);
              const year = currentWeekStart.getFullYear();
              const jan1 = new Date(year, 0, 1);
              const firstMonday = getWeekStart(jan1);
              const targetDate = new Date(firstMonday);
              targetDate.setDate(targetDate.getDate() + (targetWeek - 1) * 7);
              setCurrentWeekStart(targetDate);
            }}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue>
                {weekNumber === currentWeekNumber ? 'Huidige week' : `Week ${weekNumber}`}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 52 }, (_, i) => i + 1).map((week) => (
                <SelectItem key={week} value={week.toString()}>
                  Week {week}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-[200px] justify-between">
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {visibleEmployeeIds.length === employees.length
                    ? 'Alle medewerkers'
                    : `${visibleEmployeeIds.length} medewerker${visibleEmployeeIds.length !== 1 ? 's' : ''}`}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[200px]">
              <DropdownMenuItem onClick={selectAllEmployees}>
                Toon iedereen
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {employees.map((emp) => (
                <DropdownMenuCheckboxItem
                  key={emp.id}
                  checked={visibleEmployeeIds.includes(emp.id)}
                  onCheckedChange={() => toggleEmployee(emp.id)}
                >
                  {emp.name}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Select value={selectedClient} onValueChange={setSelectedClient}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Selecteer klant" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle klanten</SelectItem>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Right: Legend */}
        <TaskLegend />
      </div>

      {/* Grid with zoom */}
      <div
        className="origin-top-left inline-block w-full"
        style={{ 
          transform: `scale(${plannerZoom / 100})`,
          transformOrigin: 'top left',
          width: `${100 / (plannerZoom / 100)}%`
        }}
      >
        <PlannerGrid
          weekStart={currentWeekStart}
          employees={filteredEmployees}
          tasks={filteredTasks}
        />
      </div>

      {/* Fullscreen Mode */}
      {isFullscreen && (
        <FullscreenPlanner
          currentWeekStart={currentWeekStart}
          employees={filteredEmployees}
          tasks={filteredTasks}
          onClose={() => setIsFullscreen(false)}
          onWeekSelect={setCurrentWeekStart}
          initialZoom={plannerZoom}
          onZoomChange={setPlannerZoom}
        />
      )}
    </div>
  );
}
