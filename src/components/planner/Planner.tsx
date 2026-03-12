import { useState, useMemo, useEffect } from 'react';
import { Maximize2, Download, ZoomIn, ZoomOut, Users, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';

import { PlannerGrid } from './PlannerGrid';
import { FullscreenPlanner } from './FullscreenPlanner';
import { TaskEditDialog } from './TaskEditDialog';
import { getWeekStart, getWeekNumber, formatDateRange } from '@/lib/helpers/dateHelpers';
import { useEmployees } from '@/hooks/use-employees';
import { useClients } from '@/hooks/use-clients';
import { useTasks, Task } from '@/hooks/use-tasks';
import { useUpdateTask, useDeleteTask, useDeleteProjectTasks, useCompleteProject, useDeleteVerlofTasks } from '@/hooks/use-task-mutations';
import { toast } from '@/hooks/use-toast';
import { exportToCSV, exportToPDF } from '@/lib/export/planningExport';
import { secureInsert } from '@/lib/data/secureDataClient';
import { useQueryClient } from '@tanstack/react-query';
import type { Employee } from '@/lib/data/types';

const STORAGE_KEY = 'planner-visible-employees';

const zoomLevels = [50, 75, 100, 125, 150];

const LEGEND_ITEMS = [
  { label: 'Concept', color: 'bg-[hsl(var(--task-concept))]' },
  { label: 'Review', color: 'bg-[hsl(var(--task-review))]' },
  { label: 'Uitwerking', color: 'bg-[hsl(var(--task-uitwerking))]' },
  { label: 'Productie', color: 'bg-[hsl(var(--task-productie))]' },
  { label: 'Extern', color: 'bg-[hsl(var(--task-extern))]' },
  { label: 'Afwezig', color: 'bg-slate-400' },
];

export function Planner() {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getWeekStart(new Date()));
  const currentWeekNumber = getWeekNumber(getWeekStart(new Date()));
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [plannerZoom, setPlannerZoom] = useState<number>(100);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const queryClient = useQueryClient();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const deleteProjectTasks = useDeleteProjectTasks();
  const completeProject = useCompleteProject();
  const deleteVerlofTasks = useDeleteVerlofTasks();

  const handleAddToMeeting = async (task: Task, employee: Employee) => {
    const { error } = await secureInsert('taken', {
      project_id: task.project_id,
      project_nummer: task.project_nummer,
      klant_naam: task.klant_naam,
      fase_naam: task.fase_naam,
      werknemer_naam: employee.name,
      werktype: 'extern',
      discipline: employee.role || 'Algemeen',
      week_start: task.week_start,
      dag_van_week: task.dag_van_week,
      start_uur: task.start_uur,
      duur_uren: task.duur_uren,
      plan_status: task.plan_status,
      is_hard_lock: false,
    });
    if (error) {
      toast({ title: 'Fout', description: 'Kon deelnemer niet toevoegen.', variant: 'destructive' });
    } else {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast({ title: 'Deelnemer toegevoegd', description: `${employee.name} is aan de meeting toegevoegd.` });
    }
  };

  const [visibleEmployeeIds, setVisibleEmployeeIds] = useState<string[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  });

  const { data: employees = [] } = useEmployees();
  const { data: clients = [] } = useClients();
  const { data: tasksFromDb = [] } = useTasks(currentWeekStart);

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
    const visibleNames = new Set(
      employees.filter(e => visibleEmployeeIds.includes(e.id)).map(e => e.name)
    );
    return tasks.filter((task) => {
      if (!visibleNames.has(task.werknemer_naam)) return false;
      if (task.werktype === 'verlof' || task.werktype === 'ziek') return true;
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
      toast({ title: 'Export geslaagd', description: 'CSV is gedownload.' });
    } catch {
      toast({ title: 'Export mislukt', description: 'Er is een fout opgetreden bij het exporteren.', variant: 'destructive' });
    }
  };

  const handleDownloadPDF = () => {
    try {
      exportToPDF(filteredTasks, filteredEmployees, currentWeekStart, weekNumber, dateRange);
      toast({ title: 'PDF geopend', description: 'Print dialoog wordt geopend...' });
    } catch {
      toast({ title: 'Export mislukt', description: 'Er is een fout opgetreden bij het genereren van de PDF.', variant: 'destructive' });
    }
  };

  const handleZoomOut = () => {
    const i = zoomLevels.indexOf(plannerZoom);
    if (i > 0) setPlannerZoom(zoomLevels[i - 1]);
  };

  const handleZoomIn = () => {
    const i = zoomLevels.indexOf(plannerZoom);
    if (i < zoomLevels.length - 1) setPlannerZoom(zoomLevels[i + 1]);
  };

  const weekLabel = weekNumber === currentWeekNumber ? 'Huidige week' : `Week ${weekNumber}`;

  return (
    <div className="space-y-2">
      {/* Compact single toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-sm">

        {/* Week navigation */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost" size="icon" className="h-8 w-8"
            onClick={() => {
              const prev = new Date(currentWeekStart);
              prev.setDate(prev.getDate() - 7);
              setCurrentWeekStart(prev);
            }}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" className="h-8 px-2 min-w-[120px]">
                <CalendarDays className="h-4 w-4 mr-1.5 shrink-0" />
                <span className="text-sm font-medium">{weekLabel}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <div className="p-2 border-b">
                <Button
                  variant="ghost" size="sm" className="w-full justify-center text-sm"
                  onClick={() => setCurrentWeekStart(getWeekStart(new Date()))}
                >
                  Ga naar huidige week
                </Button>
              </div>
              <Calendar
                mode="single"
                selected={currentWeekStart}
                onSelect={(date) => { if (date) setCurrentWeekStart(getWeekStart(date)); }}
                initialFocus
                weekStartsOn={1}
              />
            </PopoverContent>
          </Popover>
          <Button
            variant="ghost" size="icon" className="h-8 w-8"
            onClick={() => {
              const next = new Date(currentWeekStart);
              next.setDate(next.getDate() + 7);
              setCurrentWeekStart(next);
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="h-5 w-px bg-border shrink-0 hidden sm:block" />

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5">
                <Users className="h-3.5 w-3.5" />
                <span className="text-xs">
                  {visibleEmployeeIds.length === employees.length
                    ? 'Iedereen'
                    : `${visibleEmployeeIds.length} medewerker${visibleEmployeeIds.length !== 1 ? 's' : ''}`}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[200px] max-h-72 overflow-y-auto">
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
            <SelectTrigger className="h-8 w-auto min-w-[110px] text-xs">
              <SelectValue placeholder="Alle klanten" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle klanten</SelectItem>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.name}>{client.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="h-5 w-px bg-border shrink-0 hidden md:block" />

        {/* Legend chips */}
        <div className="hidden md:flex items-center gap-x-3 gap-y-1 flex-wrap">
          {LEGEND_ITEMS.map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <div className={`h-2.5 w-4 rounded-sm shrink-0 ${item.color}`} />
              <span className="text-[11px] text-muted-foreground whitespace-nowrap">{item.label}</span>
            </div>
          ))}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Zoom */}
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleZoomOut} disabled={plannerZoom === 50}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs font-medium w-9 text-center tabular-nums">{plannerZoom}%</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleZoomIn} disabled={plannerZoom === 150}>
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>

        <div className="h-5 w-px bg-border shrink-0" />

        {/* Download + Fullscreen */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Download className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleDownloadPDF}>Deze week als PDF</DropdownMenuItem>
            <DropdownMenuItem onClick={handleDownloadCSV}>Deze week als CSV</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsFullscreen(true)}>
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Grid with zoom */}
      <div style={{ zoom: plannerZoom / 100 }}>
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
        onCompleteProject={(projectId) => completeProject.mutate(projectId)}
        onDeleteVerlof={(werknemer_naam, werktype) => deleteVerlofTasks.mutate({ werknemer_naam, werktype })}
        onAddToMeeting={handleAddToMeeting}
      />
    </div>
  );
}
