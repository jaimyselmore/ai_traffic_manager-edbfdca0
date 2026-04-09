import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { getWeekStart, getWeekNumber, formatDateRange } from '@/lib/helpers/dateHelpers';
import { TaskLegend } from '@/components/planner/TaskLegend';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useEmployees } from '@/hooks/use-employees';
import type { Employee } from '@/lib/data/types';
import { supabase } from '@/integrations/supabase/client';
import { secureSelect } from '@/lib/data/secureDataClient';

const dayNames = ['Ma', 'Di', 'Wo', 'Do', 'Vr'];
const timeSlots = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

const taskColors: Record<string, string> = {
  concept: 'bg-task-concept',
  review: 'bg-task-review',
  uitwerking: 'bg-task-uitwerking',
  productie: 'bg-task-productie',
  extern: 'bg-task-extern',
  optie: 'bg-task-optie',
};

const dagNaarIndex: Record<string, number> = {
  maandag: 0,
  dinsdag: 1,
  woensdag: 2,
  donderdag: 3,
  vrijdag: 4,
};

interface AgendaEvent {
  id: string;
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  isAllDay?: boolean;
}

interface PlanTask {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  type: string;
  clientName: string;
  employeeId: string;
}

// Confirmation Modal
interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  variant: 'destructive' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmModal({ isOpen, title, description, confirmLabel, cancelLabel, variant, onConfirm, onCancel }: ConfirmModalProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card rounded-xl shadow-lg max-w-md w-full mx-4 p-6 border border-border">
        <h2 className="text-lg font-semibold text-foreground mb-2">{title}</h2>
        <p className="text-sm text-muted-foreground mb-6">{description}</p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel}>{cancelLabel}</Button>
          <Button variant={variant === 'destructive' ? 'destructive' : 'default'} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}

// Ellen Popup Modal
type EllenStatus = 'idle' | 'busy' | 'success' | 'error';
type EllenAction = 'add' | 'delete';

interface EllenPopupProps {
  isOpen: boolean;
  status: EllenStatus;
  action: EllenAction;
  onClose: () => void;
  onRetry: () => void;
  onCancel: () => void;
}

function EllenPopup({ isOpen, status, action, onClose, onRetry, onCancel }: EllenPopupProps) {
  if (!isOpen) return null;

  const getContent = () => {
    switch (status) {
      case 'busy':
        return {
          bgClass: 'bg-card',
          icon: (
            <div className="relative">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-lg font-semibold">AI</div>
              <Loader2 className="absolute -top-1 -right-1 h-6 w-6 animate-spin text-primary" />
            </div>
          ),
          title: 'Ellen is aan het werk',
          description: 'Ellen verwerkt je actie. Even geduld…',
          actions: <Button variant="outline" onClick={onCancel}>Actie annuleren</Button>,
        };
      case 'success':
        return {
          bgClass: 'bg-green-50 dark:bg-green-950/30',
          icon: (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500 text-white">
              <CheckCircle2 className="h-8 w-8" />
            </div>
          ),
          title: action === 'delete' ? 'Afspraken verwijderd uit de agenda' : 'Planning toegevoegd aan de agenda',
          description: 'De actie is succesvol uitgevoerd.',
          actions: <Button onClick={onClose}>Terug naar agenda's</Button>,
        };
      case 'error':
        return {
          bgClass: 'bg-red-50 dark:bg-red-950/30',
          icon: (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
              <XCircle className="h-8 w-8" />
            </div>
          ),
          title: 'Actie is niet gelukt',
          description: 'Ellen kon de actie niet uitvoeren. Probeer het later opnieuw.',
          actions: (
            <div className="flex gap-3">
              <Button variant="outline" onClick={onClose}>Terug naar agenda's</Button>
              <Button onClick={onRetry}>Opnieuw proberen</Button>
            </div>
          ),
        };
      default:
        return null;
    }
  };

  const content = getContent();
  if (!content) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className={cn('rounded-xl shadow-lg max-w-md w-full mx-4 p-8 border border-border text-center', content.bgClass)}>
        <div className="flex justify-center mb-4">{content.icon}</div>
        <h2 className="text-xl font-semibold text-foreground mb-2">{content.title}</h2>
        <p className="text-sm text-muted-foreground mb-6">{content.description}</p>
        <div className="flex justify-center">{content.actions}</div>
      </div>
    </div>
  );
}

export function AgendasFlow() {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getWeekStart(new Date()));
  const currentWeekNumber = getWeekNumber(getWeekStart(new Date()));
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [showPlanner, setShowPlanner] = useState(false);

  const { data: employees = [], isLoading: isLoadingEmployees } = useEmployees();

  // Microsoft status (email configured = connected)
  const [msConnected, setMsConnected] = useState<boolean | null>(null);
  const [msLoading, setMsLoading] = useState(false);

  const selectedEmployeeData = useMemo(() => {
    return employees.find((emp) => emp.id === selectedEmployee);
  }, [employees, selectedEmployee]);

  // Real calendar events from Microsoft
  const [calendarEvents, setCalendarEvents] = useState<AgendaEvent[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);

  // Real planning tasks from database
  const [realTasks, setRealTasks] = useState<PlanTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);

  // Check Microsoft status when employee changes
  useEffect(() => {
    if (!selectedEmployee || !selectedEmployeeData) {
      setMsConnected(null);
      return;
    }
    setMsLoading(true);
    supabase.functions.invoke('microsoft-status', {
      body: { werknemerId: selectedEmployee },
    }).then(({ data, error }) => {
      if (!error && data) setMsConnected(!!data.connected);
      setMsLoading(false);
    });
  }, [selectedEmployee, selectedEmployeeData]);

  // Fetch real Microsoft calendar events when planner is shown
  useEffect(() => {
    if (!showPlanner || !selectedEmployeeData) {
      setCalendarEvents([]);
      return;
    }
    setCalendarLoading(true);
    const weekStartStr = currentWeekStart.toISOString().split('T')[0];
    supabase.functions.invoke('get-calendar-events', {
      body: { werknemerId: selectedEmployee, weekStart: weekStartStr },
    }).then(({ data, error }) => {
      if (!error && data?.events) setCalendarEvents(data.events);
      else setCalendarEvents([]);
      setCalendarLoading(false);
    });
  }, [showPlanner, selectedEmployee, selectedEmployeeData, currentWeekStart]);

  // Fetch real planning tasks from database
  useEffect(() => {
    if (!showPlanner || !selectedEmployeeData) {
      setRealTasks([]);
      return;
    }
    setTasksLoading(true);
    const weekStartStr = currentWeekStart.toISOString().split('T')[0];
    secureSelect<any>('taken', {
      filters: [
        { column: 'werknemer_naam', operator: 'eq', value: selectedEmployeeData.name },
        { column: 'week_start', operator: 'eq', value: weekStartStr },
      ],
    }).then(({ data }) => {
      if (data) {
        const transformed: PlanTask[] = (data as any[]).flatMap((taak) => {
          const dagIndex = dagNaarIndex[taak.dag_van_week];
          if (dagIndex === undefined) return [];
          const date = new Date(currentWeekStart);
          date.setDate(date.getDate() + dagIndex);
          const dateStr = date.toISOString().split('T')[0];
          const startHour = taak.start_uur ?? 9;
          const duur = taak.duur_uren ?? 1;
          return [{
            id: taak.id,
            date: dateStr,
            startTime: `${startHour.toString().padStart(2, '0')}:00`,
            endTime: `${Math.min(startHour + duur, 18).toString().padStart(2, '0')}:00`,
            type: taak.plan_status || 'concept',
            clientName: taak.klant_naam || taak.werktype || 'Taak',
            employeeId: selectedEmployee,
          }];
        });
        setRealTasks(transformed);
      }
      setTasksLoading(false);
    });
  }, [showPlanner, selectedEmployee, selectedEmployeeData, currentWeekStart]);

  // Selection states for Huidige agenda
  const [isSelectingCurrent, setIsSelectingCurrent] = useState(false);
  const [selectedAgendaEvents, setSelectedAgendaEvents] = useState<Set<string>>(new Set());

  // Selection states for Nieuwe planning
  const [isSelectingNew, setIsSelectingNew] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());

  // View options
  const [showCurrentAgenda, setShowCurrentAgenda] = useState(true);
  const [showNewPlanning, setShowNewPlanning] = useState(true);
  const [validationMessage, setValidationMessage] = useState('');

  // Modal states
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; type: 'delete' | 'add' }>({ isOpen: false, type: 'add' });
  const [ellenPopup, setEllenPopup] = useState<{ isOpen: boolean; status: EllenStatus; action: EllenAction }>({ isOpen: false, status: 'idle', action: 'add' });

  const weekNumber = getWeekNumber(currentWeekStart);
  const dateRange = formatDateRange(currentWeekStart);

  // Reset employee if removed
  useEffect(() => {
    if (!selectedEmployee || employees.length === 0) return;
    if (!employees.some((e) => e.id === selectedEmployee)) setSelectedEmployee('');
  }, [employees, selectedEmployee]);

  // Ensure at least one view is selected
  useEffect(() => {
    if (!showCurrentAgenda && !showNewPlanning) {
      setShowNewPlanning(true);
      setValidationMessage('Minimaal één weergave moet actief zijn.');
      setTimeout(() => setValidationMessage(''), 3000);
    } else {
      setValidationMessage('');
    }
  }, [showCurrentAgenda, showNewPlanning]);

  const handleShowPlanner = () => {
    if (selectedEmployee) {
      setShowPlanner(true);
      setIsSelectingCurrent(false);
      setIsSelectingNew(false);
      setSelectedAgendaEvents(new Set());
      setSelectedTasks(new Set());
    }
  };

  const toggleCurrentSelectionMode = () => {
    if (isSelectingCurrent) setSelectedAgendaEvents(new Set());
    setIsSelectingCurrent(!isSelectingCurrent);
  };

  const toggleAgendaEventSelection = (eventId: string) => {
    if (!isSelectingCurrent) return;
    const newSelection = new Set(selectedAgendaEvents);
    newSelection.has(eventId) ? newSelection.delete(eventId) : newSelection.add(eventId);
    setSelectedAgendaEvents(newSelection);
  };

  const selectAllAgendaEvents = () => setSelectedAgendaEvents(new Set(calendarEvents.map(e => e.id)));

  const handleDeleteAgendaEvents = () => {
    if (selectedAgendaEvents.size === 0) return;
    setConfirmModal({ isOpen: true, type: 'delete' });
  };

  const toggleNewSelectionMode = () => {
    if (isSelectingNew) setSelectedTasks(new Set());
    setIsSelectingNew(!isSelectingNew);
  };

  const toggleTaskSelection = (taskId: string) => {
    if (!isSelectingNew) return;
    const newSelection = new Set(selectedTasks);
    newSelection.has(taskId) ? newSelection.delete(taskId) : newSelection.add(taskId);
    setSelectedTasks(newSelection);
  };

  const selectAllTasks = () => setSelectedTasks(new Set(realTasks.map(t => t.id)));

  const handleAddToAgenda = () => {
    if (selectedTasks.size === 0) return;
    setConfirmModal({ isOpen: true, type: 'add' });
  };

  const handleConfirmAction = () => {
    const actionType = confirmModal.type;
    setConfirmModal({ isOpen: false, type: 'add' });
    setEllenPopup({ isOpen: true, status: 'busy', action: actionType === 'delete' ? 'delete' : 'add' });
    setTimeout(() => {
      const isSuccess = Math.random() > 0.3;
      setEllenPopup(prev => ({ ...prev, status: isSuccess ? 'success' : 'error' }));
    }, 2000);
  };

  const handleEllenClose = () => {
    setEllenPopup({ isOpen: false, status: 'idle', action: 'add' });
    setShowPlanner(false);
    setSelectedEmployee('');
    setIsSelectingCurrent(false);
    setIsSelectingNew(false);
    setSelectedAgendaEvents(new Set());
    setSelectedTasks(new Set());
  };

  const handleEllenRetry = () => {
    setEllenPopup(prev => ({ ...prev, status: 'busy' }));
    setTimeout(() => {
      const isSuccess = Math.random() > 0.3;
      setEllenPopup(prev => ({ ...prev, status: isSuccess ? 'success' : 'error' }));
    }, 2000);
  };

  const goToWeek = (week: number) => {
    const year = currentWeekStart.getFullYear();
    const jan1 = new Date(year, 0, 1);
    const firstMonday = getWeekStart(jan1);
    const targetDate = new Date(firstMonday);
    targetDate.setDate(targetDate.getDate() + (week - 1) * 7);
    setCurrentWeekStart(targetDate);
  };

  return (
    <div className="space-y-8">
      {/* Selection card + Legend row */}
      <div className="flex items-start gap-6 mb-6">
        {/* Controls card */}
        <div className="shrink-0">
          <div className="rounded-xl border border-border bg-card px-4 py-4 shadow-sm flex flex-col gap-3">
            <Select value={weekNumber.toString()} onValueChange={(v) => goToWeek(parseInt(v))}>
              <SelectTrigger className="w-[200px]">
                <SelectValue>
                  {weekNumber === currentWeekNumber ? 'Huidige week' : `Week ${weekNumber}`}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 52 }, (_, i) => i + 1).map((week) => (
                  <SelectItem key={week} value={week.toString()}>Week {week}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedEmployee} onValueChange={setSelectedEmployee} disabled={isLoadingEmployees}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={isLoadingEmployees ? 'Laden...' : 'Selecteer medewerker'} />
              </SelectTrigger>
              <SelectContent>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Microsoft status */}
            {selectedEmployee && (
              <div className="pt-2 border-t border-border mt-2">
                {msLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Status ophalen...</span>
                  </div>
                ) : msConnected !== null ? (
                  <div className="flex items-center gap-2">
                    {msConnected ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-xs font-medium text-green-700 dark:text-green-400">Microsoft agenda gekoppeld</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Geen agenda gekoppeld — stel in via Admin</span>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            )}

            {/* View options */}
            {selectedEmployee && (
              <div className="flex items-center gap-6 pt-2 border-t border-border mt-2">
                <div className="flex items-center space-x-2">
                  <Checkbox id="currentAgenda" checked={showCurrentAgenda} onCheckedChange={(c) => setShowCurrentAgenda(c === true)} />
                  <label htmlFor="currentAgenda" className="text-sm font-medium leading-none cursor-pointer">Huidige agenda</label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="newPlanning" checked={showNewPlanning} onCheckedChange={(c) => setShowNewPlanning(c === true)} />
                  <label htmlFor="newPlanning" className="text-sm font-medium leading-none cursor-pointer">Nieuwe planning</label>
                </div>
              </div>
            )}
            {validationMessage && <p className="text-xs text-amber-600 mt-2">{validationMessage}</p>}

            <Button className="w-full mt-3" disabled={!selectedEmployee} onClick={handleShowPlanner}>
              Toon planner
            </Button>
          </div>
        </div>

        {/* Legend */}
        {showPlanner && showNewPlanning && (
          <div className="shrink-0"><TaskLegend /></div>
        )}
      </div>

      {/* Planner views */}
      {showPlanner && selectedEmployeeData && (
        <>
          {/* Huidige agenda */}
          {showCurrentAgenda && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-foreground">
                  Huidige agenda
                  {calendarLoading && <Loader2 className="inline ml-2 h-4 w-4 animate-spin text-muted-foreground" />}
                </h2>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={toggleCurrentSelectionMode}>
                    {isSelectingCurrent ? 'Selectie annuleren' : 'Selecteren'}
                  </Button>
                  {isSelectingCurrent && (
                    <>
                      <Button variant="ghost" size="sm" onClick={selectAllAgendaEvents}>Alles selecteren</Button>
                      <Button variant="destructive" size="sm" disabled={selectedAgendaEvents.size === 0} onClick={handleDeleteAgendaEvents}>Verwijderen</Button>
                    </>
                  )}
                </div>
              </div>
              <div className="w-full overflow-auto">
                <AgendaGrid
                  weekStart={currentWeekStart}
                  employee={selectedEmployeeData}
                  events={calendarEvents}
                  loading={calendarLoading}
                  selectionMode={isSelectingCurrent}
                  selectedEvents={selectedAgendaEvents}
                  onEventClick={toggleAgendaEventSelection}
                />
              </div>
            </div>
          )}

          {/* Nieuwe planning */}
          {showNewPlanning && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-foreground">
                  Nieuwe planning
                  {tasksLoading && <Loader2 className="inline ml-2 h-4 w-4 animate-spin text-muted-foreground" />}
                </h2>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={toggleNewSelectionMode}>
                    {isSelectingNew ? 'Selectie annuleren' : 'Selecteren'}
                  </Button>
                  {isSelectingNew && (
                    <>
                      <Button variant="ghost" size="sm" onClick={selectAllTasks}>Alles selecteren</Button>
                      <Button size="sm" disabled={selectedTasks.size === 0} onClick={handleAddToAgenda}>Toevoegen</Button>
                    </>
                  )}
                </div>
              </div>
              <div className="w-full overflow-auto">
                <PlanningGrid
                  weekStart={currentWeekStart}
                  employee={selectedEmployeeData}
                  tasks={realTasks}
                  loading={tasksLoading}
                  selectionMode={isSelectingNew}
                  selectedTasks={selectedTasks}
                  onTaskClick={toggleTaskSelection}
                />
              </div>
            </div>
          )}
        </>
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.type === 'delete' ? 'Weet je zeker dat je deze afspraken wilt verwijderen?' : 'Weet je zeker dat je deze planning wilt toevoegen?'}
        description={confirmModal.type === 'delete' ? 'Deze afspraken worden uit de agenda verwijderd. Dit kan niet ongedaan worden gemaakt.' : 'De geselecteerde planningsblokken worden toegevoegd aan de agenda.'}
        confirmLabel={confirmModal.type === 'delete' ? 'Ja, verwijderen' : 'Ja, toevoegen'}
        cancelLabel="Annuleren"
        variant={confirmModal.type === 'delete' ? 'destructive' : 'default'}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmModal({ isOpen: false, type: 'add' })}
      />

      <EllenPopup
        isOpen={ellenPopup.isOpen}
        status={ellenPopup.status}
        action={ellenPopup.action}
        onClose={handleEllenClose}
        onRetry={handleEllenRetry}
        onCancel={() => setEllenPopup({ isOpen: false, status: 'idle', action: 'add' })}
      />
    </div>
  );
}

// Agenda Grid
interface AgendaGridProps {
  weekStart: Date;
  employee: Employee;
  events: AgendaEvent[];
  loading: boolean;
  selectionMode: boolean;
  selectedEvents: Set<string>;
  onEventClick: (eventId: string) => void;
}

function AgendaGrid({ weekStart, employee, events, loading, selectionMode, selectedEvents, onEventClick }: AgendaGridProps) {
  const weekDates = useMemo(() => {
    return dayNames.map((_, index) => {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + index);
      return date;
    });
  }, [weekStart]);

  const getEventsForCell = (date: Date, hour: number) => {
    const dateStr = date.toISOString().split('T')[0];
    return events.filter((event) => {
      if (event.date !== dateStr || !event.startTime || !event.endTime) return false;
      const startHour = parseInt(event.startTime.split(':')[0]);
      const endHour = parseInt(event.endTime.split(':')[0]);
      return hour >= startHour && hour < endHour;
    });
  };

  return (
    <div className="rounded-lg border border-border bg-card">
      {loading && events.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Agenda ophalen uit Microsoft…
        </div>
      ) : !loading && events.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
          Geen agenda-items gevonden voor deze week
        </div>
      ) : (
        <table className="w-full border-collapse table-fixed">
          <thead>
            <tr className="bg-secondary">
              <th className="sticky left-0 z-10 bg-secondary border-b border-r border-border px-4 py-3 text-left text-sm font-medium text-muted-foreground w-48">Medewerker</th>
              <th className="sticky left-48 z-10 bg-secondary border-b border-r border-border px-2 py-3 text-center text-xs font-medium text-muted-foreground w-14">Uur</th>
              {weekDates.map((date, index) => (
                <th key={index} className="border-b border-r border-border px-2 py-3 text-center text-sm font-medium text-foreground">
                  <div>{dayNames[index]}</div>
                  <div className="text-xs text-muted-foreground">{date.getDate()}/{date.getMonth() + 1}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {timeSlots.map((hour, hourIndex) => (
              <tr key={`${employee.id}-${hour}`} className={cn(hour === 13 && 'bg-task-lunch/30')}>
                {hourIndex === 0 && (
                  <td rowSpan={timeSlots.length} className="sticky left-0 z-10 bg-card border-b border-r border-border px-4 py-2 align-top">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-500 text-xs font-medium text-white">
                        {employee.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <div className="font-medium text-foreground text-sm">{employee.name}</div>
                        <div className="text-xs text-muted-foreground">{employee.role}</div>
                      </div>
                    </div>
                  </td>
                )}
                <td className={cn('sticky left-48 z-10 border-b border-r border-border px-2 py-1 text-center text-xs font-medium', hour === 13 ? 'bg-task-lunch/30 text-muted-foreground' : 'bg-card text-muted-foreground')}>
                  {hour === 13 ? 'Lunch' : `${hour.toString().padStart(2, '0')}:00`}
                </td>
                {weekDates.map((date, dayIndex) => {
                  const cellEvents = getEventsForCell(date, hour);
                  return (
                    <td key={dayIndex} className={cn('border-b border-r border-border p-0.5', hour === 13 && 'bg-task-lunch/30')} style={{ height: '32px' }}>
                      {cellEvents.map((event) => {
                        const startHour = event.startTime ? parseInt(event.startTime.split(':')[0]) : hour;
                        if (hour !== startHour) return null;
                        const isSelected = selectedEvents.has(event.id);
                        return (
                          <div
                            key={event.id}
                            onClick={() => onEventClick(event.id)}
                            className={cn('rounded px-1.5 py-0.5 text-xs text-white overflow-hidden h-full bg-slate-500 transition-all', selectionMode && 'cursor-pointer hover:ring-2 hover:ring-primary', isSelected && 'ring-2 ring-blue-500 ring-offset-1')}
                            title={`${event.title}\n${event.startTime} - ${event.endTime}`}
                          >
                            <div className="truncate font-medium">{event.title}</div>
                          </div>
                        );
                      })}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// Planning Grid
interface PlanningGridProps {
  weekStart: Date;
  employee: Employee;
  tasks: PlanTask[];
  loading: boolean;
  selectionMode: boolean;
  selectedTasks: Set<string>;
  onTaskClick: (taskId: string) => void;
}

function PlanningGrid({ weekStart, employee, tasks, loading, selectionMode, selectedTasks, onTaskClick }: PlanningGridProps) {
  const weekDates = useMemo(() => {
    return dayNames.map((_, index) => {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + index);
      return date;
    });
  }, [weekStart]);

  const getTasksForCell = (date: Date, hour: number) => {
    const dateStr = date.toISOString().split('T')[0];
    return tasks.filter((task) => {
      if (task.date !== dateStr) return false;
      const startHour = parseInt(task.startTime.split(':')[0]);
      const endHour = parseInt(task.endTime.split(':')[0]);
      return hour >= startHour && hour < endHour;
    });
  };

  const getTaskLabel = (type: string) => {
    const labels: Record<string, string> = {
      concept: 'Concept', review: 'Review', uitwerking: 'Uitwerking',
      productie: 'Productie', extern: 'Extern', optie: 'Optie',
    };
    return labels[type] || type;
  };

  return (
    <div className="rounded-lg border border-border bg-card">
      {loading && tasks.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Planning ophalen…
        </div>
      ) : !loading && tasks.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
          Geen geplande taken voor deze medewerker in week {getWeekNumber(weekStart)}
        </div>
      ) : (
        <table className="w-full border-collapse table-fixed">
          <thead>
            <tr className="bg-secondary">
              <th className="sticky left-0 z-10 bg-secondary border-b border-r border-border px-4 py-3 text-left text-sm font-medium text-muted-foreground w-48">Medewerker</th>
              <th className="sticky left-48 z-10 bg-secondary border-b border-r border-border px-2 py-3 text-center text-xs font-medium text-muted-foreground w-14">Uur</th>
              {weekDates.map((date, index) => (
                <th key={index} className="border-b border-r border-border px-2 py-3 text-center text-sm font-medium text-foreground">
                  <div>{dayNames[index]}</div>
                  <div className="text-xs text-muted-foreground">{date.getDate()}/{date.getMonth() + 1}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {timeSlots.map((hour, hourIndex) => (
              <tr key={`${employee.id}-${hour}`} className={cn(hour === 13 && 'bg-task-lunch/30')}>
                {hourIndex === 0 && (
                  <td rowSpan={timeSlots.length} className="sticky left-0 z-10 bg-card border-b border-r border-border px-4 py-2 align-top">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                        {employee.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <div className="font-medium text-foreground text-sm">{employee.name}</div>
                        <div className="text-xs text-muted-foreground">{employee.role}</div>
                      </div>
                    </div>
                  </td>
                )}
                <td className={cn('sticky left-48 z-10 border-b border-r border-border px-2 py-1 text-center text-xs font-medium', hour === 13 ? 'bg-task-lunch/30 text-muted-foreground' : 'bg-card text-muted-foreground')}>
                  {hour === 13 ? 'Lunch' : `${hour.toString().padStart(2, '0')}:00`}
                </td>
                {weekDates.map((date, dayIndex) => {
                  const cellTasks = getTasksForCell(date, hour);
                  return (
                    <td key={dayIndex} className={cn('border-b border-r border-border p-0.5', hour === 13 && 'bg-task-lunch/30')} style={{ height: '32px' }}>
                      {cellTasks.map((task) => {
                        const startHour = parseInt(task.startTime.split(':')[0]);
                        if (hour !== startHour) return null;
                        const isSelected = selectedTasks.has(task.id);
                        return (
                          <div
                            key={task.id}
                            onClick={() => onTaskClick(task.id)}
                            className={cn('rounded px-1.5 py-0.5 text-xs text-white overflow-hidden transition-all h-full', taskColors[task.type] || 'bg-task-concept', selectionMode && 'cursor-pointer hover:ring-2 hover:ring-primary', isSelected && 'ring-2 ring-blue-500 ring-offset-1')}
                            title={`${task.clientName} - ${getTaskLabel(task.type)}\n${task.startTime} - ${task.endTime}`}
                          >
                            <div className="truncate font-medium">{task.clientName}</div>
                            <div className="truncate opacity-80 text-[10px]">{getTaskLabel(task.type)}</div>
                          </div>
                        );
                      })}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
