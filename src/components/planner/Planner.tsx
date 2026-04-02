import { useState, useMemo, useEffect } from 'react';
import { Maximize2, Download, ZoomIn, ZoomOut, Users, ChevronLeft, ChevronRight, CalendarDays, Plus, X } from 'lucide-react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

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

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addTitel, setAddTitel] = useState('');
  const [addType, setAddType] = useState<'concept' | 'uitwerking' | 'productie' | 'extern' | 'review'>('concept');
  const [addDag, setAddDag] = useState(0);
  const [addStartuur, setAddStartuur] = useState(9);
  const [addDuur, setAddDuur] = useState(2);
  const [addMedewerker, setAddMedewerker] = useState('');
  const [addKlant, setAddKlant] = useState('');
  const [isAddingBlock, setIsAddingBlock] = useState(false);

  const handleAddBlock = async () => {
    if (!addMedewerker || !addTitel) return;
    const emp = employees.find(e => e.name === addMedewerker);
    const weekStartISO = currentWeekStart.toISOString().split('T')[0];
    setIsAddingBlock(true);
    const { error } = await secureInsert('taken', {
      klant_naam: addKlant || 'Intern',
      fase_naam: addTitel,
      werknemer_naam: addMedewerker,
      werktype: addType,
      discipline: emp?.role || 'Algemeen',
      week_start: weekStartISO,
      dag_van_week: addDag,
      start_uur: addStartuur,
      duur_uren: addDuur,
      plan_status: 'vast',
      is_hard_lock: false,
    });
    setIsAddingBlock(false);
    if (error) {
      toast({ title: 'Fout', description: 'Kon blok niet toevoegen.', variant: 'destructive' });
    } else {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast({ title: 'Blok toegevoegd' });
      setShowAddDialog(false);
      setAddTitel('');
      setAddType('concept');
      setAddDag(0);
      setAddStartuur(9);
      setAddDuur(2);
      setAddMedewerker('');
      setAddKlant('');
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

        {/* Download + Blok toevoegen + Fullscreen */}
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

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="Blok toevoegen"
          onClick={() => {
            setAddMedewerker(filteredEmployees[0]?.name || '');
            setShowAddDialog(true);
          }}
        >
          <Plus className="h-4 w-4" />
        </Button>

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

      {/* Nieuw blok toevoegen */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              Nieuw blok toevoegen
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            {/* Titel */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Titel</label>
              <input
                type="text"
                autoFocus
                value={addTitel}
                onChange={e => setAddTitel(e.target.value)}
                placeholder="Naam van het blok"
                className="h-9 w-full rounded border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            {/* Klant */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Klant (optioneel)</label>
              <select
                value={addKlant}
                onChange={e => setAddKlant(e.target.value)}
                className="h-9 w-full rounded border border-border bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Intern</option>
                {clients.map(client => (
                  <option key={client.id} value={client.name}>{client.name}</option>
                ))}
              </select>
            </div>
            {/* Type */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Type</label>
              <div className="flex flex-wrap gap-1.5">
                {([
                  { id: 'concept', label: 'Concept', color: 'bg-[hsl(var(--task-concept))]' },
                  { id: 'uitwerking', label: 'Uitwerking', color: 'bg-[hsl(var(--task-uitwerking))]' },
                  { id: 'productie', label: 'Productie', color: 'bg-[hsl(var(--task-productie))]' },
                  { id: 'extern', label: 'Extern', color: 'bg-[hsl(var(--task-extern))]' },
                  { id: 'review', label: 'Review', color: 'bg-[hsl(var(--task-review))]' },
                ] as const).map(opt => (
                  <button key={opt.id} type="button"
                    onClick={() => setAddType(opt.id)}
                    className={cn(
                      'flex items-center gap-1.5 rounded border px-2 py-1.5 text-[11px] font-medium transition-colors',
                      addType === opt.id
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background text-foreground hover:border-primary/40'
                    )}
                  >
                    <span className={cn('h-2.5 w-2.5 rounded-full flex-shrink-0', opt.color)} />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Medewerker */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Medewerker</label>
              <select
                value={addMedewerker}
                onChange={e => setAddMedewerker(e.target.value)}
                className="h-9 w-full rounded border border-border bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {employees.map(emp => <option key={emp.id} value={emp.name}>{emp.name}</option>)}
              </select>
            </div>
            {/* Dag + Tijd */}
            <div className="flex gap-3">
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Dag</label>
                <select
                  value={addDag}
                  onChange={e => setAddDag(Number(e.target.value))}
                  className="h-9 w-full rounded border border-border bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {['Maandag','Dinsdag','Woensdag','Donderdag','Vrijdag'].map((d, i) => (
                    <option key={i} value={i}>{d}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Start</label>
                <select
                  value={addStartuur}
                  onChange={e => setAddStartuur(Number(e.target.value))}
                  className="h-9 rounded border border-border bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {[8,9,10,11,12,13,14,15,16,17].map(h => (
                    <option key={h} value={h}>{h}:00</option>
                  ))}
                </select>
              </div>
            </div>
            {/* Duur */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Duur</label>
              <div className="flex gap-1.5">
                {[1, 2, 4, 8].map(d => (
                  <button key={d} type="button"
                    onClick={() => setAddDuur(d)}
                    className={cn(
                      'flex-1 h-9 rounded border text-sm font-medium transition-colors',
                      addDuur === d
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background text-foreground hover:border-primary/50'
                    )}
                  >{d}u</button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Annuleren</Button>
            <Button
              onClick={handleAddBlock}
              disabled={!addTitel || !addMedewerker || isAddingBlock}
            >
              {isAddingBlock ? 'Toevoegen...' : 'Toevoegen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
