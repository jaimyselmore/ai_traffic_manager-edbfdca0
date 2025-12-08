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
import { mockEmployees, mockClients, generateMockTasks, getWeekStart, getWeekNumber, formatDateRange, Task, Employee } from '@/lib/mockData';
import { TaskLegend } from '@/components/planner/TaskLegend';
import { toast } from '@/hooks/use-toast';

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

export function AgendasFlow() {
  const navigate = useNavigate();
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getWeekStart(new Date()));
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [showPlanner, setShowPlanner] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  
  // View options
  const [showCurrentAgenda, setShowCurrentAgenda] = useState(true);
  const [showNewPlanning, setShowNewPlanning] = useState(true);
  const [validationMessage, setValidationMessage] = useState('');

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
    return mockEmployees.find(emp => emp.id === selectedEmployee);
  }, [selectedEmployee]);

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
      setSelectionMode(false);
      setSelectedTasks(new Set());
    }
  };

  const toggleSelectionMode = () => {
    if (selectionMode) {
      setSelectedTasks(new Set());
    }
    setSelectionMode(!selectionMode);
  };

  const toggleTaskSelection = (taskId: string) => {
    if (!selectionMode) return;
    const newSelection = new Set(selectedTasks);
    if (newSelection.has(taskId)) {
      newSelection.delete(taskId);
    } else {
      newSelection.add(taskId);
    }
    setSelectedTasks(newSelection);
  };

  const handleAddToAgenda = () => {
    if (selectedTasks.size === 0 || !selectedEmployeeData) return;
    
    navigate('/agenda-resultaat', {
      state: {
        employeeName: selectedEmployeeData.name,
        taskCount: selectedTasks.size,
      }
    });
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
    <div className="max-w-6xl pl-8 pr-8 pt-6 pb-10">
      {/* Header - only week title */}
      <h1 className="text-2xl font-semibold text-foreground mb-6">
        <span className="font-bold">Week {weekNumber}</span>
        <span className="font-normal text-muted-foreground"> – {dateRange}</span>
      </h1>

      {/* Legend + Selection card row */}
      <div className="flex items-start gap-6 mb-6">
        {/* Legend card */}
        <div className="shrink-0">
          <TaskLegend />
        </div>

        {/* Week + Medewerker + Options + Toon planner card */}
        <div className="flex-1 max-w-md">
          <div className="rounded-xl border border-border bg-card px-6 py-5 shadow-sm">
            {/* Week controls */}
            <div className="flex items-center gap-3 mb-4">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setCurrentWeekStart(getWeekStart(new Date()))}
              >
                Huidige week
              </Button>
              <span className="text-sm text-muted-foreground">Ga naar week:</span>
              <div className="ml-auto w-20">
                <Select 
                  value={weekNumber.toString()} 
                  onValueChange={(v) => goToWeek(parseInt(v))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 52 }, (_, i) => i + 1).map((week) => (
                      <SelectItem key={week} value={week.toString()}>
                        {week}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Medewerker select */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm text-muted-foreground">Medewerker:</span>
              <div className="ml-auto w-48">
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecteer medewerker" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockEmployees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* View options */}
            <div className="space-y-3 mb-4">
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
              {validationMessage && (
                <p className="text-xs text-amber-600">{validationMessage}</p>
              )}
            </div>

            {/* Description */}
            <p className="text-sm text-muted-foreground mb-4">
              Kies welke weergaven je wilt zien: de huidige agenda, de nieuwe planning, of allebei.
            </p>

            {/* Show planner button */}
            <Button 
              className="w-full" 
              disabled={!selectedEmployee}
              onClick={handleShowPlanner}
            >
              Toon planner
            </Button>
          </div>
        </div>
      </div>

      {/* Planner views for selected employee */}
      {showPlanner && selectedEmployeeData && (
        <>
          {/* Current Agenda view */}
          {showCurrentAgenda && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-foreground mb-3">Huidige agenda</h2>
              <div className="w-full overflow-auto">
                <AgendaGrid
                  weekStart={currentWeekStart}
                  employee={selectedEmployeeData}
                  events={agendaEvents}
                />
              </div>
            </div>
          )}

          {/* New Planning view */}
          {showNewPlanning && (
            <div className="mb-6">
              {/* Header with title and Selecteren button */}
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-foreground">Nieuwe planning</h2>
                <Button 
                  variant={selectionMode ? "secondary" : "outline"}
                  size="sm"
                  onClick={toggleSelectionMode}
                >
                  {selectionMode ? 'Selectie annuleren' : 'Selecteren'}
                </Button>
              </div>
              <div className="w-full overflow-auto">
                <PlanningGrid
                  weekStart={currentWeekStart}
                  employee={selectedEmployeeData}
                  tasks={filteredTasks}
                  selectionMode={selectionMode}
                  selectedTasks={selectedTasks}
                  onTaskClick={toggleTaskSelection}
                />
              </div>
            </div>
          )}

          {/* Add to agenda button - right aligned */}
          {showNewPlanning && (
            <div className="flex justify-end">
              <Button 
                disabled={selectedTasks.size === 0}
                onClick={handleAddToAgenda}
              >
                Aan agenda toevoegen
                {selectedTasks.size > 0 && ` (${selectedTasks.size})`}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Agenda Grid - shows current calendar events in neutral colors
interface AgendaGridProps {
  weekStart: Date;
  employee: Employee;
  events: AgendaEvent[];
}

function AgendaGrid({ weekStart, employee, events }: AgendaGridProps) {
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
                      
                      return (
                        <div
                          key={event.id}
                          className="rounded px-1.5 py-0.5 text-xs text-white overflow-hidden h-full bg-slate-500"
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
