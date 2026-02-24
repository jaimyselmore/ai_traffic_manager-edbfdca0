import { useState, useMemo, useEffect } from 'react';
import { Maximize2, Download, ZoomIn, ZoomOut, Users, ChevronLeft, ChevronRight } from 'lucide-react';
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
import { TaskEditDialog } from './TaskEditDialog';
import { getWeekStart, getWeekNumber, formatDateRange } from '@/lib/helpers/dateHelpers';
import { useEmployees } from '@/hooks/use-employees';
import { useClients } from '@/hooks/use-clients';
import { useTasks, Task } from '@/hooks/use-tasks';
import { useUpdateTask, useDeleteTask, useDeleteProjectTasks } from '@/hooks/use-task-mutations';
import { toast } from '@/hooks/use-toast';
import { exportToCSV, exportToPDF } from '@/lib/export/planningExport';

const STORAGE_KEY = 'planner-visible-employees';

const zoomLevels = [50, 75, 100, 125, 150];

export function Planner() {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getWeekStart(new Date()));
  const currentWeekNumber = getWeekNumber(getWeekStart(new Date()));
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [plannerZoom, setPlannerZoom] = useState<number>(100);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const deleteProjectTasks = useDeleteProjectTasks();

  const [visibleEmployeeIds, setVisibleEmployeeIds] = useState<string[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  });

  const { data: employees = [], isLoading: isLoadingEmployees } = useEmployees();
  const { data: clients = [], isLoading: isLoadingClients } = useClients();
  const { data: tasksFromDb = [], isLoading: isLoadingTasks } = useTasks(currentWeekStart);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(visibleEmployeeIds));
  }, [visibleEmployeeIds]);

  useEffect(() => {
    if (employees.length > 0 && visibleEmployeeIds.length === 0) {
      setVisibleEmployeeIds(employees.map(e => e.id));
    }
  }, [employees]);

  const weekNumber = getWeekNumber(currentWeekStart);
  const dateRange = formatDateRange(currentWeekStart);

  const tasks = useMemo(() => tasksFromDb, [tasksFromDb]);

  const filteredTasks = useMemo(() => {
    // Build a set of visible employee names for matching with tasks
    const visibleNames = new Set(
      employees.filter(e => visibleEmployeeIds.includes(e.id)).map(e => e.name)
    );
    return tasks.filter((task) => {
      if (!visibleNames.has(task.werknemer_naam)) return false;
      if (selectedClient !== 'all' && task.klant_naam !== selectedClient) return false;
      return true;
    });
  }, [tasks, visibleEmployeeIds, selectedClient, employees]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => visibleEmployeeIds.includes(emp.id));
  }, [employees, visibleEmployeeIds]);

  const toggleEmployee = (employeeId: string) => {
    setVisibleEmployeeIds(prev => {
      if (prev.includes(employeeId)) {
        if (prev.length === 1) return prev;
        return prev.filter(id => id !== employeeId);
      }
      return [...prev, employeeId];
    });
  };

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
    <div className="space-y-2">
      {/* Header with controls on same line */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Planner</h1>
          <p className="mt-1 text-base text-muted-foreground">
            Week {currentWeekNumber} – {formatDateRange(getWeekStart(new Date()))}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 self-center">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleZoomOut} disabled={plannerZoom === 50}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Select value={plannerZoom.toString()} onValueChange={(v) => setPlannerZoom(parseInt(v))}>
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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                <Download className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Download</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={handleDownloadPDF}>Deze week als PDF</DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownloadCSV}>Deze week als CSV</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="sm" className="h-9" onClick={() => setIsFullscreen(true)}>
            <Maximize2 className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Vergroot planner</span>
          </Button>
        </div>
      </div>

      {/* Filter card left + Legend right + Week nav arrows bottom-right */}
      <div className="flex items-end justify-between">
        <div className="flex items-start gap-8">
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
                    {week === currentWeekNumber ? `Huidige week (${week})` : `Week ${week}`}
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
                <DropdownMenuItem onClick={selectAllEmployees} onSelect={(e) => e.preventDefault()}>
                  Toon iedereen
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {employees.map((emp) => (
                  <DropdownMenuCheckboxItem
                    key={emp.id}
                    checked={visibleEmployeeIds.includes(emp.id)}
                    onCheckedChange={() => toggleEmployee(emp.id)}
                    onSelect={(e) => e.preventDefault()}
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
                  <SelectItem key={client.id} value={client.name}>{client.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <TaskLegend />
        </div>

        {/* Week navigation arrows */}
        <div className="flex items-center gap-1 pb-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => {
            const prev = new Date(currentWeekStart);
            prev.setDate(prev.getDate() - 7);
            setCurrentWeekStart(prev);
          }}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium text-foreground min-w-[80px] text-center">
            {weekNumber === currentWeekNumber ? 'Huidige week' : `Week ${weekNumber}`}
          </span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => {
            const next = new Date(currentWeekStart);
            next.setDate(next.getDate() + 7);
            setCurrentWeekStart(next);
          }}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
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
          onTaskClick={setSelectedTask}
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

      {/* Task Edit Dialog */}
      <TaskEditDialog
        task={selectedTask}
        allWeekTasks={filteredTasks}
        employees={employees}
        onClose={() => setSelectedTask(null)}
        onUpdate={(id, updates) => updateTask.mutate({ id, updates })}
        onDelete={(id) => deleteTask.mutate(id)}
        onDeleteProject={(projectId) => deleteProjectTasks.mutate(projectId)}
      />
    </div>
  );
}
