import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { mockClients, generateMockTasks, getWeekStart, getWeekNumber, formatDateRange, Task } from '@/lib/mockData';
import { TaskLegend } from '@/components/planner/TaskLegend';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useEmployees } from '@/hooks/use-employees';
import type { Employee } from '@/lib/data/types';

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

// Mock current agenda events (existing calendar items)
interface AgendaEvent {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
}

const generateMockAgendaEvents = (weekStart: Date, employeeId: string): AgendaEvent[] => {
  const events: AgendaEvent[] = [];
  const eventTypes = ['Vergadering', 'Klantgesprek', 'Teamoverleg', 'Review', 'Stand-up', 'Workshop'];
  
  for (let day = 0; day < 5; day++) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + day);
    const dateStr = date.toISOString().split('T')[0];
    
    // Add 0-2 events per day
    const numEvents = Math.floor(Math.random() * 3);
    const usedSlots: { start: number; end: number }[] = [];
    
    for (let i = 0; i < numEvents; i++) {
      let startHour = 9 + Math.floor(Math.random() * 7);
      if (startHour === 13) startHour = 14; // Skip lunch
      const duration = Math.floor(Math.random() * 2) + 1;
      const endHour = Math.min(startHour + duration, 18);
      
      const hasOverlap = usedSlots.some(
        slot => !(endHour <= slot.start || startHour >= slot.end)
      );
      
      if (!hasOverlap && startHour < 18) {
        usedSlots.push({ start: startHour, end: endHour });
        events.push({
          id: `agenda-${employeeId}-${dateStr}-${i}`,
          title: eventTypes[Math.floor(Math.random() * eventTypes.length)],
          date: dateStr,
          startTime: `${startHour.toString().padStart(2, '0')}:00`,
          endTime: `${endHour.toString().padStart(2, '0')}:00`,
        });
      }
    }
  }
  
  return events;
};

// Confirmation Modal Component
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

function ConfirmModal({ 
  isOpen, 
  title, 
  description, 
  confirmLabel, 
  cancelLabel,
  variant,
  onConfirm, 
  onCancel 
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card rounded-xl shadow-lg max-w-md w-full mx-4 p-6 border border-border">
        <h2 className="text-lg font-semibold text-foreground mb-2">{title}</h2>
        <p className="text-sm text-muted-foreground mb-6">{description}</p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button 
            variant={variant === 'destructive' ? 'destructive' : 'default'} 
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Ellen Popup Modal Component
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
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-lg font-semibold">
                AI
              </div>
              <Loader2 className="absolute -top-1 -right-1 h-6 w-6 animate-spin text-primary" />
            </div>
          ),
          title: 'Ellen is aan het werk',
          description: 'Ellen verwerkt je actie. Even geduld…',
          actions: (
            <Button variant="outline" onClick={onCancel}>
              Actie annuleren
            </Button>
          ),
        };
      case 'success':
        return {
          bgClass: 'bg-green-50 dark:bg-green-950/30',
          icon: (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500 text-white">
              <CheckCircle2 className="h-8 w-8" />
            </div>
          ),
          title: action === 'delete' 
            ? 'Afspraken verwijderd uit de agenda' 
            : 'Planning toegevoegd aan de agenda',
          description: 'De actie is succesvol uitgevoerd. Je kunt de agenda opnieuw openen om de wijzigingen te zien.',
          actions: (
            <Button onClick={onClose}>
              Terug naar agenda's
            </Button>
          ),
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
              <Button variant="outline" onClick={onClose}>
                Terug naar agenda's
              </Button>
              <Button onClick={onRetry}>
                Opnieuw proberen
              </Button>
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
      <div className={cn(
        "rounded-xl shadow-lg max-w-md w-full mx-4 p-8 border border-border text-center",
        content.bgClass
      )}>
        <div className="flex justify-center mb-4">
          {content.icon}
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">{content.title}</h2>
        <p className="text-sm text-muted-foreground mb-6">{content.description}</p>
        <div className="flex justify-center">
          {content.actions}
        </div>
      </div>
    </div>
  );
}

export function AgendasFlow() {
  const navigate = useNavigate();
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getWeekStart(new Date()));
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [showPlanner, setShowPlanner] = useState(false);

  // Medewerkers uit Supabase (zelfde bron als Planner)
  const { data: employees = [], isLoading: isLoadingEmployees } = useEmployees();
  
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
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'delete' | 'add';
  }>({ isOpen: false, type: 'add' });
  
  const [ellenPopup, setEllenPopup] = useState<{
    isOpen: boolean;
    status: EllenStatus;
    action: EllenAction;
  }>({ isOpen: false, status: 'idle', action: 'add' });

  const weekNumber = getWeekNumber(currentWeekStart);
  const dateRange = formatDateRange(currentWeekStart);

  const tasks = useMemo(() => generateMockTasks(currentWeekStart), [currentWeekStart]);
  
  const agendaEvents = useMemo(() => {
    if (!selectedEmployee) return [];
    return generateMockAgendaEvents(currentWeekStart, selectedEmployee);
  }, [currentWeekStart, selectedEmployee]);

  const filteredTasks = useMemo(() => {
    if (!selectedEmployee) return [];
    return tasks.filter((task) => task.employeeId === selectedEmployee);
  }, [tasks, selectedEmployee]);

  const selectedEmployeeData = useMemo(() => {
    return employees.find((emp) => emp.id === selectedEmployee);
  }, [employees, selectedEmployee]);

  // Als de geselecteerde medewerker niet meer bestaat (bijv. verwijderd), reset selectie.
  useEffect(() => {
    if (!selectedEmployee) return;
    if (employees.length === 0) return;
    const exists = employees.some((e) => e.id === selectedEmployee);
    if (!exists) setSelectedEmployee('');
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
      // Reset all selection states
      setIsSelectingCurrent(false);
      setIsSelectingNew(false);
      setSelectedAgendaEvents(new Set());
      setSelectedTasks(new Set());
    }
  };

  // Huidige agenda selection handlers
  const toggleCurrentSelectionMode = () => {
    if (isSelectingCurrent) {
      setSelectedAgendaEvents(new Set());
    }
    setIsSelectingCurrent(!isSelectingCurrent);
  };

  const toggleAgendaEventSelection = (eventId: string) => {
    if (!isSelectingCurrent) return;
    const newSelection = new Set(selectedAgendaEvents);
    if (newSelection.has(eventId)) {
      newSelection.delete(eventId);
    } else {
      newSelection.add(eventId);
    }
    setSelectedAgendaEvents(newSelection);
  };

  const selectAllAgendaEvents = () => {
    const allIds = new Set(agendaEvents.map(e => e.id));
    setSelectedAgendaEvents(allIds);
  };

  const handleDeleteAgendaEvents = () => {
    if (selectedAgendaEvents.size === 0) return;
    setConfirmModal({ isOpen: true, type: 'delete' });
  };

  // Nieuwe planning selection handlers
  const toggleNewSelectionMode = () => {
    if (isSelectingNew) {
      setSelectedTasks(new Set());
    }
    setIsSelectingNew(!isSelectingNew);
  };

  const toggleTaskSelection = (taskId: string) => {
    if (!isSelectingNew) return;
    const newSelection = new Set(selectedTasks);
    if (newSelection.has(taskId)) {
      newSelection.delete(taskId);
    } else {
      newSelection.add(taskId);
    }
    setSelectedTasks(newSelection);
  };

  const selectAllTasks = () => {
    const allIds = new Set(filteredTasks.map(t => t.id));
    setSelectedTasks(allIds);
  };

  const handleAddToAgenda = () => {
    if (selectedTasks.size === 0) return;
    setConfirmModal({ isOpen: true, type: 'add' });
  };

  // Confirm modal handlers
  const handleConfirmAction = () => {
    const actionType = confirmModal.type;
    setConfirmModal({ isOpen: false, type: 'add' });
    
    // Open Ellen popup in busy state
    setEllenPopup({ 
      isOpen: true, 
      status: 'busy', 
      action: actionType === 'delete' ? 'delete' : 'add' 
    });

    // Simulate processing (2 seconds, then random success/error)
    setTimeout(() => {
      const isSuccess = Math.random() > 0.3; // 70% success rate
      setEllenPopup(prev => ({
        ...prev,
        status: isSuccess ? 'success' : 'error'
      }));
    }, 2000);
  };

  const handleCancelConfirm = () => {
    setConfirmModal({ isOpen: false, type: 'add' });
  };

  // Ellen popup handlers
  const handleEllenClose = () => {
    setEllenPopup({ isOpen: false, status: 'idle', action: 'add' });
    // Reset all states and go back to initial state
    setShowPlanner(false);
    setSelectedEmployee('');
    setIsSelectingCurrent(false);
    setIsSelectingNew(false);
    setSelectedAgendaEvents(new Set());
    setSelectedTasks(new Set());
  };

  const handleEllenRetry = () => {
    // Retry the action
    setEllenPopup(prev => ({ ...prev, status: 'busy' }));
    setTimeout(() => {
      const isSuccess = Math.random() > 0.3;
      setEllenPopup(prev => ({
        ...prev,
        status: isSuccess ? 'success' : 'error'
      }));
    }, 2000);
  };

  const handleEllenCancel = () => {
    setEllenPopup({ isOpen: false, status: 'idle', action: 'add' });
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
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Agenda's</h1>
        <p className="mt-1 text-base text-muted-foreground">
          Week {weekNumber} – {dateRange}
        </p>
      </div>

      {/* Selection card + Legend row */}
      <div className="flex items-start gap-6 mb-6">
        {/* Week + Medewerker + Options + Toon planner card - LEFT */}
        <div className="shrink-0">
          <div className="rounded-xl border border-border bg-card px-4 py-4 shadow-sm flex flex-col gap-3">
            <Select 
              value={weekNumber.toString()} 
              onValueChange={(v) => goToWeek(parseInt(v))}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Selecteer week" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 52 }, (_, i) => i + 1).map((week) => (
                  <SelectItem key={week} value={week.toString()}>
                    Week {week}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedEmployee} onValueChange={setSelectedEmployee} disabled={isLoadingEmployees}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={isLoadingEmployees ? 'Laden...' : 'Selecteer medewerker'} />
              </SelectTrigger>
              <SelectContent>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* View options - only show after employee is selected */}
            {selectedEmployee && (
              <div className="flex items-center gap-6 pt-2 border-t border-border mt-2">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="currentAgenda" 
                    checked={showCurrentAgenda}
                    onCheckedChange={(checked) => setShowCurrentAgenda(checked === true)}
                  />
                  <label htmlFor="currentAgenda" className="text-sm font-medium leading-none cursor-pointer">
                    Huidige agenda
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="newPlanning" 
                    checked={showNewPlanning}
                    onCheckedChange={(checked) => setShowNewPlanning(checked === true)}
                  />
                  <label htmlFor="newPlanning" className="text-sm font-medium leading-none cursor-pointer">
                    Nieuwe planning
                  </label>
                </div>
              </div>
            )}
            {validationMessage && (
              <p className="text-xs text-amber-600 mt-2">{validationMessage}</p>
            )}

            {/* Show planner button */}
            <Button 
              className="w-full mt-3" 
              disabled={!selectedEmployee}
              onClick={handleShowPlanner}
            >
              Toon planner
            </Button>
          </div>
        </div>

        {/* Legend card - RIGHT, only visible when planner is shown and Nieuwe planning is checked */}
        {showPlanner && showNewPlanning && (
          <div className="shrink-0">
            <TaskLegend />
          </div>
        )}
      </div>

      {/* Planner views for selected employee */}
      {showPlanner && selectedEmployeeData && (
        <>
          {/* Current Agenda view */}
          {showCurrentAgenda && (
            <div className="mb-6">
              {/* Header with selection controls */}
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-foreground">Huidige agenda</h2>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={toggleCurrentSelectionMode}
                  >
                    {isSelectingCurrent ? 'Selectie annuleren' : 'Selecteren'}
                  </Button>
                  {isSelectingCurrent && (
                    <>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={selectAllAgendaEvents}
                      >
                        Alles selecteren
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        disabled={selectedAgendaEvents.size === 0}
                        onClick={handleDeleteAgendaEvents}
                      >
                        Verwijderen
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <div className="w-full overflow-auto">
                <AgendaGrid
                  weekStart={currentWeekStart}
                  employee={selectedEmployeeData}
                  events={agendaEvents}
                  selectionMode={isSelectingCurrent}
                  selectedEvents={selectedAgendaEvents}
                  onEventClick={toggleAgendaEventSelection}
                />
              </div>
            </div>
          )}

          {/* New Planning view */}
          {showNewPlanning && (
            <div className="mb-6">
              {/* Header with selection controls */}
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-foreground">Nieuwe planning</h2>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={toggleNewSelectionMode}
                  >
                    {isSelectingNew ? 'Selectie annuleren' : 'Selecteren'}
                  </Button>
                  {isSelectingNew && (
                    <>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={selectAllTasks}
                      >
                        Alles selecteren
                      </Button>
                      <Button 
                        size="sm"
                        disabled={selectedTasks.size === 0}
                        onClick={handleAddToAgenda}
                      >
                        Toevoegen
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <div className="w-full overflow-auto">
                <PlanningGrid
                  weekStart={currentWeekStart}
                  employee={selectedEmployeeData}
                  tasks={filteredTasks}
                  selectionMode={isSelectingNew}
                  selectedTasks={selectedTasks}
                  onTaskClick={toggleTaskSelection}
                />
              </div>
            </div>
          )}
        </>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.type === 'delete' 
          ? 'Weet je zeker dat je deze afspraken wilt verwijderen?' 
          : 'Weet je zeker dat je deze planning wilt toevoegen?'}
        description={confirmModal.type === 'delete'
          ? 'Deze afspraken worden uit de agenda verwijderd. Dit kan niet ongedaan worden gemaakt.'
          : 'De geselecteerde planningsblokken worden toegevoegd aan de agenda.'}
        confirmLabel={confirmModal.type === 'delete' ? 'Ja, verwijderen' : 'Ja, toevoegen'}
        cancelLabel="Annuleren"
        variant={confirmModal.type === 'delete' ? 'destructive' : 'default'}
        onConfirm={handleConfirmAction}
        onCancel={handleCancelConfirm}
      />

      {/* Ellen Popup Modal */}
      <EllenPopup
        isOpen={ellenPopup.isOpen}
        status={ellenPopup.status}
        action={ellenPopup.action}
        onClose={handleEllenClose}
        onRetry={handleEllenRetry}
        onCancel={handleEllenCancel}
      />
    </div>
  );
}

// Agenda Grid - shows current calendar events with selection support
interface AgendaGridProps {
  weekStart: Date;
  employee: Employee;
  events: AgendaEvent[];
  selectionMode: boolean;
  selectedEvents: Set<string>;
  onEventClick: (eventId: string) => void;
}

function AgendaGrid({ weekStart, employee, events, selectionMode, selectedEvents, onEventClick }: AgendaGridProps) {
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
      if (event.date !== dateStr) return false;
      const startHour = parseInt(event.startTime.split(':')[0]);
      const endHour = parseInt(event.endTime.split(':')[0]);
      return hour >= startHour && hour < endHour;
    });
  };

  const getEventStart = (event: AgendaEvent, hour: number) => {
    const startHour = parseInt(event.startTime.split(':')[0]);
    return hour === startHour;
  };

  return (
    <div className="rounded-lg border border-border bg-card">
      <table className="w-full border-collapse table-fixed">
        <thead>
          <tr className="bg-secondary">
            <th className="sticky left-0 z-10 bg-secondary border-b border-r border-border px-4 py-3 text-left text-sm font-medium text-muted-foreground w-48">
              Medewerker
            </th>
            <th className="sticky left-48 z-10 bg-secondary border-b border-r border-border px-2 py-3 text-center text-xs font-medium text-muted-foreground w-14">
              Uur
            </th>
            {weekDates.map((date, index) => (
              <th
                key={index}
                className="border-b border-r border-border px-2 py-3 text-center text-sm font-medium text-foreground"
              >
                <div>{dayNames[index]}</div>
                <div className="text-xs text-muted-foreground">
                  {date.getDate()}/{date.getMonth() + 1}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {timeSlots.map((hour, hourIndex) => (
            <tr key={`${employee.id}-${hour}`} className={cn(
              hour === 13 && 'bg-task-lunch/30'
            )}>
              {hourIndex === 0 && (
                <td 
                  rowSpan={timeSlots.length}
                  className="sticky left-0 z-10 bg-card border-b border-r border-border px-4 py-2 align-top"
                >
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
              <td className={cn(
                "sticky left-48 z-10 border-b border-r border-border px-2 py-1 text-center text-xs font-medium",
                hour === 13 ? 'bg-task-lunch/30 text-muted-foreground' : 'bg-card text-muted-foreground'
              )}>
                {hour === 13 ? 'Lunch' : `${hour.toString().padStart(2, '0')}:00`}
              </td>
              {weekDates.map((date, dayIndex) => {
                const cellEvents = getEventsForCell(date, hour);
                const isLunchHour = hour === 13;
                
                return (
                  <td
                    key={dayIndex}
                    className={cn(
                      "border-b border-r border-border p-0.5",
                      isLunchHour && 'bg-task-lunch/30'
                    )}
                    style={{ height: '32px' }}
                  >
                    {cellEvents.map((event) => {
                      const isStart = getEventStart(event, hour);
                      if (!isStart) return null;
                      
                      const isSelected = selectedEvents.has(event.id);
                      
                      return (
                        <div
                          key={event.id}
                          onClick={() => onEventClick(event.id)}
                          className={cn(
                            "rounded px-1.5 py-0.5 text-xs text-white overflow-hidden h-full bg-slate-500 transition-all",
                            selectionMode && 'cursor-pointer hover:ring-2 hover:ring-primary',
                            isSelected && 'ring-2 ring-blue-500 ring-offset-1'
                          )}
                          title={`${event.title}\n${event.startTime} - ${event.endTime}`}
                        >
                          <div className="truncate font-medium">
                            {event.title}
                          </div>
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
    </div>
  );
}

// Planning Grid - shows new planning with task colors and selection
interface PlanningGridProps {
  weekStart: Date;
  employee: Employee;
  tasks: Task[];
  selectionMode: boolean;
  selectedTasks: Set<string>;
  onTaskClick: (taskId: string) => void;
}

function PlanningGrid({ 
  weekStart, 
  employee, 
  tasks, 
  selectionMode,
  selectedTasks,
  onTaskClick 
}: PlanningGridProps) {
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

  const getTaskStart = (task: Task, hour: number) => {
    const startHour = parseInt(task.startTime.split(':')[0]);
    return hour === startHour;
  };

  const getClientName = (clientId: string) => {
    return mockClients.find(c => c.id === clientId)?.name || '';
  };

  const getTaskLabel = (type: string) => {
    const labels: Record<string, string> = {
      concept: 'Concept',
      review: 'Review',
      uitwerking: 'Uitwerking',
      productie: 'Productie',
      extern: 'Extern',
      optie: 'Optie',
    };
    return labels[type] || type;
  };

  return (
    <div className="rounded-lg border border-border bg-card">
      <table className="w-full border-collapse table-fixed">
        <thead>
          <tr className="bg-secondary">
            <th className="sticky left-0 z-10 bg-secondary border-b border-r border-border px-4 py-3 text-left text-sm font-medium text-muted-foreground w-48">
              Medewerker
            </th>
            <th className="sticky left-48 z-10 bg-secondary border-b border-r border-border px-2 py-3 text-center text-xs font-medium text-muted-foreground w-14">
              Uur
            </th>
            {weekDates.map((date, index) => (
              <th
                key={index}
                className="border-b border-r border-border px-2 py-3 text-center text-sm font-medium text-foreground"
              >
                <div>{dayNames[index]}</div>
                <div className="text-xs text-muted-foreground">
                  {date.getDate()}/{date.getMonth() + 1}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {timeSlots.map((hour, hourIndex) => (
            <tr key={`${employee.id}-${hour}`} className={cn(
              hour === 13 && 'bg-task-lunch/30'
            )}>
              {hourIndex === 0 && (
                <td 
                  rowSpan={timeSlots.length}
                  className="sticky left-0 z-10 bg-card border-b border-r border-border px-4 py-2 align-top"
                >
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
              <td className={cn(
                "sticky left-48 z-10 border-b border-r border-border px-2 py-1 text-center text-xs font-medium",
                hour === 13 ? 'bg-task-lunch/30 text-muted-foreground' : 'bg-card text-muted-foreground'
              )}>
                {hour === 13 ? 'Lunch' : `${hour.toString().padStart(2, '0')}:00`}
              </td>
              {weekDates.map((date, dayIndex) => {
                const cellTasks = getTasksForCell(date, hour);
                const isLunchHour = hour === 13;
                
                return (
                  <td
                    key={dayIndex}
                    className={cn(
                      "border-b border-r border-border p-0.5",
                      isLunchHour && 'bg-task-lunch/30'
                    )}
                    style={{ height: '32px' }}
                  >
                    {cellTasks.map((task) => {
                      const isStart = getTaskStart(task, hour);
                      if (!isStart) return null;
                      
                      const isSelected = selectedTasks.has(task.id);
                      
                      return (
                        <div
                          key={task.id}
                          onClick={() => onTaskClick(task.id)}
                          className={cn(
                            'rounded px-1.5 py-0.5 text-xs text-white overflow-hidden transition-all h-full',
                            taskColors[task.type],
                            selectionMode && 'cursor-pointer hover:ring-2 hover:ring-primary',
                            isSelected && 'ring-2 ring-blue-500 ring-offset-1'
                          )}
                          title={`${getClientName(task.clientId)} - ${getTaskLabel(task.type)}\n${task.startTime} - ${task.endTime}`}
                        >
                          <div className="truncate font-medium">
                            {getClientName(task.clientId)}
                          </div>
                          <div className="truncate opacity-80 text-[10px]">
                            {getTaskLabel(task.type)}
                          </div>
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
    </div>
  );
}
