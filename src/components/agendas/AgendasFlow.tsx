import { useState, useMemo, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getWeekStart, getWeekNumber, formatDateRange } from '@/lib/helpers/dateHelpers';
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
  CalendarDays,
  CalendarOff,
  Sparkles,
  Send,
  AlertCircle,
} from 'lucide-react';
import { useEmployees } from '@/hooks/use-employees';
import type { Employee } from '@/lib/data/types';
import { supabase } from '@/integrations/supabase/client';
import { secureSelect, getSessionToken } from '@/lib/data/secureDataClient';

// ── Types ────────────────────────────────────────────────────────────────────

const dagNaarIndex: Record<string, number> = {
  maandag: 0, dinsdag: 1, woensdag: 2, donderdag: 3, vrijdag: 4,
};

const dayNames = ['Ma', 'Di', 'Wo', 'Do', 'Vr'];
const timeSlots = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

const taskColors: Record<string, string> = {
  concept: 'bg-[hsl(var(--task-concept))]',
  review: 'bg-[hsl(var(--task-review))]',
  uitwerking: 'bg-[hsl(var(--task-uitwerking))]',
  productie: 'bg-[hsl(var(--task-productie))]',
  extern: 'bg-[hsl(var(--task-extern))]',
  optie: 'bg-[hsl(var(--task-optie))]',
};

interface AgendaEvent {
  id: string;
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  isAllDay?: boolean;
  location?: string | null;
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

// ── Skeleton Row ─────────────────────────────────────────────────────────────

function SkeletonGrid() {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden animate-pulse">
      <div className="bg-secondary/60 h-10 w-full" />
      {[...Array(6)].map((_, i) => (
        <div key={i} className="flex border-t border-border">
          <div className="w-16 h-8 bg-muted/40 border-r border-border shrink-0" />
          {[...Array(5)].map((_, j) => (
            <div key={j} className="flex-1 h-8 border-r border-border last:border-r-0">
              {i === 1 && j === 1 && <div className="m-0.5 h-7 bg-muted/60 rounded" />}
              {i === 3 && j === 3 && <div className="m-0.5 h-7 bg-muted/40 rounded" />}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ icon: Icon, title, description }: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card flex flex-col items-center justify-center py-16 gap-3">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
    </div>
  );
}

// ── Agenda Grid ──────────────────────────────────────────────────────────────

interface AgendaGridProps {
  weekStart: Date;
  employee: Employee;
  events: AgendaEvent[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  selectionMode: boolean;
  selectedEvents: Set<string>;
  onEventClick: (id: string) => void;
}

function AgendaGrid({ weekStart, employee, events, loading, error, onRetry, selectionMode, selectedEvents, onEventClick }: AgendaGridProps) {
  const weekDates = useMemo(() =>
    dayNames.map((_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    }), [weekStart]);

  const parseHour = (t: string) => parseInt(t.substring(0, 2), 10);

  const getEventsForCell = (date: Date, hour: number) => {
    const dateStr = date.toISOString().split('T')[0];
    return events.filter(ev => {
      if (ev.date !== dateStr || !ev.startTime || !ev.endTime) return false;
      return hour >= parseHour(ev.startTime) && hour < parseHour(ev.endTime);
    });
  };

  if (loading) return <SkeletonGrid />;

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 flex flex-col items-center justify-center py-12 gap-3">
        <AlertCircle className="h-5 w-5 text-destructive" />
        <p className="text-sm text-destructive font-medium">{error}</p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Opnieuw proberen
        </Button>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <EmptyState
        icon={CalendarOff}
        title="Geen agenda-items gevonden"
        description={`${employee.name} heeft geen afspraken in Microsoft 365 voor deze week`}
      />
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-auto">
      <table className="w-full border-collapse" style={{ minWidth: 600 }}>
        <thead>
          <tr className="bg-secondary/60">
            <th className="sticky left-0 z-10 bg-secondary/60 w-14 border-b border-r border-border px-2 py-2.5 text-center text-xs font-medium text-muted-foreground">
              Uur
            </th>
            {weekDates.map((date, i) => (
              <th key={i} className="border-b border-r border-border px-3 py-2.5 text-center text-xs font-medium text-foreground last:border-r-0">
                <span className="font-semibold">{dayNames[i]}</span>
                <span className="ml-1 font-normal text-muted-foreground">{date.getDate()}/{date.getMonth() + 1}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {timeSlots.map((hour) => (
            <tr key={hour} className={cn('group', hour === 12 && 'bg-muted/20')}>
              <td className="sticky left-0 z-10 bg-card border-b border-r border-border px-2 py-0 text-center text-[11px] text-muted-foreground w-14 h-8 group-hover:bg-secondary/30 transition-colors">
                {hour === 12 ? '12:00' : `${hour}:00`}
              </td>
              {weekDates.map((date, di) => {
                const cellEvents = getEventsForCell(date, hour);
                return (
                  <td key={di} className={cn(
                    'border-b border-r border-border p-0.5 last:border-r-0 h-8 align-top',
                    hour === 12 && 'bg-muted/20',
                  )}>
                    {cellEvents.map(ev => {
                      const startH = ev.startTime ? parseHour(ev.startTime) : hour;
                      if (hour !== startH) return null;
                      const isSelected = selectedEvents.has(ev.id);
                      return (
                        <div
                          key={ev.id}
                          onClick={() => onEventClick(ev.id)}
                          className={cn(
                            'rounded px-1.5 py-0.5 text-[11px] font-medium text-white bg-slate-500 overflow-hidden transition-all h-full leading-tight',
                            selectionMode && 'cursor-pointer hover:ring-2 hover:ring-primary ring-offset-1',
                            isSelected && 'ring-2 ring-blue-500 ring-offset-1',
                          )}
                          title={`${ev.title}${ev.location ? ` · ${ev.location}` : ''}\n${ev.startTime} – ${ev.endTime}`}
                        >
                          <div className="truncate">{ev.title}</div>
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

// ── Planning Grid ─────────────────────────────────────────────────────────────

interface PlanningGridProps {
  weekStart: Date;
  employee: Employee;
  tasks: PlanTask[];
  loading: boolean;
  selectionMode: boolean;
  selectedTasks: Set<string>;
  onTaskClick: (id: string) => void;
}

function PlanningGrid({ weekStart, employee, tasks, loading, selectionMode, selectedTasks, onTaskClick }: PlanningGridProps) {
  const weekDates = useMemo(() =>
    dayNames.map((_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    }), [weekStart]);

  const parseHour = (t: string) => parseInt(t.substring(0, 2), 10);

  const getTasksForCell = (date: Date, hour: number) =>
    tasks.filter(t => {
      if (t.date !== date.toISOString().split('T')[0]) return false;
      return hour >= parseHour(t.startTime) && hour < parseHour(t.endTime);
    });

  const taskLabel: Record<string, string> = {
    concept: 'Concept', review: 'Review', uitwerking: 'Uitwerking',
    productie: 'Productie', extern: 'Extern', optie: 'Optie',
  };

  if (loading) return <SkeletonGrid />;

  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="Geen geplande taken"
        description={`${employee.name} heeft geen taken in de planner voor deze week`}
      />
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-auto">
      <table className="w-full border-collapse" style={{ minWidth: 600 }}>
        <thead>
          <tr className="bg-secondary/60">
            <th className="sticky left-0 z-10 bg-secondary/60 w-14 border-b border-r border-border px-2 py-2.5 text-center text-xs font-medium text-muted-foreground">
              Uur
            </th>
            {weekDates.map((date, i) => (
              <th key={i} className="border-b border-r border-border px-3 py-2.5 text-center text-xs font-medium text-foreground last:border-r-0">
                <span className="font-semibold">{dayNames[i]}</span>
                <span className="ml-1 font-normal text-muted-foreground">{date.getDate()}/{date.getMonth() + 1}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {timeSlots.map((hour) => (
            <tr key={hour} className={cn('group', hour === 12 && 'bg-muted/20')}>
              <td className="sticky left-0 z-10 bg-card border-b border-r border-border px-2 py-0 text-center text-[11px] text-muted-foreground w-14 h-8 group-hover:bg-secondary/30 transition-colors">
                {hour === 12 ? '12:00' : `${hour}:00`}
              </td>
              {weekDates.map((date, di) => {
                const cellTasks = getTasksForCell(date, hour);
                return (
                  <td key={di} className={cn(
                    'border-b border-r border-border p-0.5 last:border-r-0 h-8 align-top',
                    hour === 12 && 'bg-muted/20',
                  )}>
                    {cellTasks.map(task => {
                      if (hour !== parseHour(task.startTime)) return null;
                      const isSelected = selectedTasks.has(task.id);
                      return (
                        <div
                          key={task.id}
                          onClick={() => onTaskClick(task.id)}
                          className={cn(
                            'rounded px-1.5 py-0.5 text-[11px] text-white overflow-hidden transition-all h-full leading-tight',
                            taskColors[task.type] || 'bg-[hsl(var(--task-concept))]',
                            selectionMode && 'cursor-pointer hover:ring-2 hover:ring-primary ring-offset-1',
                            isSelected && 'ring-2 ring-blue-500 ring-offset-1',
                          )}
                          title={`${task.clientName} · ${taskLabel[task.type] || task.type}\n${task.startTime} – ${task.endTime}`}
                        >
                          <div className="truncate font-medium">{task.clientName}</div>
                          <div className="truncate opacity-80 text-[10px]">{taskLabel[task.type] || task.type}</div>
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

// ── Ellen Panel ───────────────────────────────────────────────────────────────

interface EllenPanelProps {
  employee: Employee;
  weekNumber: number;
  events: AgendaEvent[];
  tasks: PlanTask[];
}

function EllenPanel({ employee, weekNumber, events, tasks }: EllenPanelProps) {
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [customQuestion, setCustomQuestion] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const sendToEllen = async (question: string) => {
    if (!question.trim() || loading) return;
    setLoading(true);
    setResponse('');

    const eventsText = events.length > 0
      ? events.map(e => `- ${e.date} ${e.startTime ?? ''}${e.endTime ? `–${e.endTime}` : ''}: ${e.title}${e.location ? ` (${e.location})` : ''}`).join('\n')
      : '(geen agenda-items)';

    const tasksText = tasks.length > 0
      ? tasks.map(t => `- ${t.date} ${t.startTime}–${t.endTime}: ${t.clientName} (${t.type})`).join('\n')
      : '(geen geplande taken)';

    const bericht = `${question}

Medewerker: ${employee.name}
Week: ${weekNumber}

Microsoft 365 agenda:
${eventsText}

Planningsblokken:
${tasksText}`;

    try {
      const sessionToken = getSessionToken();
      const { data, error } = await supabase.functions.invoke('ellen-chat', {
        body: { bericht, sessie_id: `agenda-${employee.id}-w${weekNumber}` },
        headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {},
      });
      if (error) throw error;
      setResponse(data?.antwoord || 'Geen antwoord ontvangen.');
    } catch {
      setResponse('Er ging iets mis bij het ophalen van Ellen\'s analyse. Probeer het opnieuw.');
    } finally {
      setLoading(false);
    }
  };

  const quickQuestions = [
    `Analyseer de beschikbaarheid van ${employee.name} voor week ${weekNumber}`,
    `Zijn er conflicten tussen de agenda en de planning van ${employee.name}?`,
    `Hoeveel vrije ruimte heeft ${employee.name} nog in week ${weekNumber}?`,
  ];

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border bg-primary/5">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Sparkles className="h-3.5 w-3.5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Ellen — Agenda analyse</p>
          <p className="text-xs text-muted-foreground">Stel Ellen een vraag over de agenda van {employee.name}</p>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Quick questions */}
        {!response && !loading && (
          <div className="flex flex-wrap gap-2">
            {quickQuestions.map((q, i) => (
              <button
                key={i}
                onClick={() => sendToEllen(q)}
                className="text-xs px-3 py-1.5 rounded-full border border-border bg-secondary/50 hover:bg-secondary text-foreground transition-colors cursor-pointer"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Response area */}
        {(loading || response) && (
          <div className={cn(
            'rounded-lg p-3 text-sm leading-relaxed min-h-[60px]',
            loading ? 'bg-secondary/40' : 'bg-secondary/20 text-foreground'
          )}>
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span className="text-xs">Ellen analyseert de agenda…</span>
              </div>
            ) : (
              <p className="whitespace-pre-wrap text-sm">{response}</p>
            )}
          </div>
        )}

        {/* Custom question input */}
        <div className="flex gap-2 pt-1">
          <input
            ref={inputRef}
            type="text"
            value={customQuestion}
            onChange={e => setCustomQuestion(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                sendToEllen(customQuestion);
                setCustomQuestion('');
              }
            }}
            placeholder="Stel Ellen een eigen vraag…"
            disabled={loading}
            className="flex-1 h-8 text-sm rounded-md border border-border bg-background px-3 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
          <Button
            size="sm"
            className="h-8 px-3"
            disabled={loading || !customQuestion.trim()}
            onClick={() => { sendToEllen(customQuestion); setCustomQuestion(''); }}
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function AgendasFlow() {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getWeekStart(new Date()));
  const todayWeekStart = getWeekStart(new Date());
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'agenda' | 'planning'>('agenda');

  const { data: employees = [], isLoading: isLoadingEmployees } = useEmployees();

  const selectedEmployeeData = useMemo(
    () => employees.find(e => e.id === selectedEmployee),
    [employees, selectedEmployee]
  );

  // Microsoft status
  const [msConnected, setMsConnected] = useState<boolean | null>(null);

  // Calendar events
  const [calendarEvents, setCalendarEvents] = useState<AgendaEvent[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);

  // Planning tasks
  const [realTasks, setRealTasks] = useState<PlanTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);

  // Selection for agenda
  const [isSelectingAgenda, setIsSelectingAgenda] = useState(false);
  const [selectedAgendaEvents, setSelectedAgendaEvents] = useState<Set<string>>(new Set());

  // Selection for planning
  const [isSelectingPlanning, setIsSelectingPlanning] = useState(false);
  const [selectedPlanTasks, setSelectedPlanTasks] = useState<Set<string>>(new Set());

  const weekNumber = getWeekNumber(currentWeekStart);
  const isCurrentWeek = currentWeekStart.toDateString() === todayWeekStart.toDateString();
  const dateRange = formatDateRange(currentWeekStart);

  // Week navigation
  const goToPrevWeek = () => {
    setCurrentWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; });
  };
  const goToNextWeek = () => {
    setCurrentWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; });
  };
  const goToCurrentWeek = () => setCurrentWeekStart(getWeekStart(new Date()));

  // Check Microsoft status
  useEffect(() => {
    if (!selectedEmployee) { setMsConnected(null); return; }
    supabase.functions.invoke('microsoft-status', { body: { werknemerId: selectedEmployee } })
      .then(({ data, error }) => {
        if (!error && data) setMsConnected(!!data.connected);
        else setMsConnected(false);
      });
  }, [selectedEmployee]);

  // Fetch calendar events
  const fetchCalendarEvents = () => {
    if (!selectedEmployee) return;
    setCalendarLoading(true);
    setCalendarError(null);
    const weekStartStr = currentWeekStart.toISOString().split('T')[0];
    supabase.functions.invoke('get-calendar-events', {
      body: { werknemerId: selectedEmployee, weekStart: weekStartStr },
    }).then(({ data, error }) => {
      if (error || data?.error) {
        setCalendarError(data?.error || 'Kon agenda niet ophalen uit Microsoft 365');
        setCalendarEvents([]);
      } else {
        setCalendarEvents(data?.events || []);
      }
      setCalendarLoading(false);
    });
  };

  // Fetch planning tasks
  const fetchPlanningTasks = () => {
    if (!selectedEmployeeData) return;
    setTasksLoading(true);
    const weekStartStr = currentWeekStart.toISOString().split('T')[0];
    secureSelect<any>('taken', {
      filters: [
        { column: 'werknemer_naam', operator: 'eq', value: selectedEmployeeData.name },
        { column: 'week_start', operator: 'eq', value: weekStartStr },
      ],
    }).then(({ data }) => {
      if (data) {
        const transformed: PlanTask[] = (data as any[]).flatMap(taak => {
          const dagIndex = dagNaarIndex[taak.dag_van_week];
          if (dagIndex === undefined) return [];
          const date = new Date(currentWeekStart);
          date.setDate(date.getDate() + dagIndex);
          const dateStr = date.toISOString().split('T')[0];
          const startH = taak.start_uur ?? 9;
          const duur = taak.duur_uren ?? 1;
          return [{
            id: taak.id,
            date: dateStr,
            startTime: `${startH.toString().padStart(2, '0')}:00`,
            endTime: `${Math.min(startH + duur, 18).toString().padStart(2, '0')}:00`,
            type: taak.plan_status || 'concept',
            clientName: taak.klant_naam || taak.werktype || 'Taak',
            employeeId: selectedEmployee,
          }];
        });
        setRealTasks(transformed);
      }
      setTasksLoading(false);
    });
  };

  useEffect(() => {
    if (!selectedEmployee) {
      setCalendarEvents([]);
      setRealTasks([]);
      return;
    }
    fetchCalendarEvents();
    fetchPlanningTasks();
    // Reset selections on change
    setIsSelectingAgenda(false);
    setIsSelectingPlanning(false);
    setSelectedAgendaEvents(new Set());
    setSelectedPlanTasks(new Set());
  }, [selectedEmployee, currentWeekStart]);

  // Reset employee if deleted
  useEffect(() => {
    if (selectedEmployee && employees.length > 0 && !employees.some(e => e.id === selectedEmployee)) {
      setSelectedEmployee('');
    }
  }, [employees, selectedEmployee]);

  const toggleAgendaEvent = (id: string) => {
    if (!isSelectingAgenda) return;
    setSelectedAgendaEvents(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const togglePlanTask = (id: string) => {
    if (!isSelectingPlanning) return;
    setSelectedPlanTasks(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const hasData = selectedEmployee && (calendarEvents.length > 0 || realTasks.length > 0);

  return (
    <div className="space-y-5">

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3 flex-wrap">

        {/* Week navigation */}
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card px-1 py-1">
          <button
            onClick={goToPrevWeek}
            className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-secondary transition-colors cursor-pointer"
            aria-label="Vorige week"
          >
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          </button>
          <button
            onClick={goToCurrentWeek}
            disabled={isCurrentWeek}
            className={cn(
              'px-3 h-7 rounded-md text-sm font-medium transition-colors',
              isCurrentWeek
                ? 'text-muted-foreground cursor-default'
                : 'hover:bg-secondary cursor-pointer text-foreground'
            )}
          >
            <span className="font-semibold">Week {weekNumber}</span>
            <span className="ml-2 text-xs text-muted-foreground hidden sm:inline">{dateRange}</span>
          </button>
          <button
            onClick={goToNextWeek}
            className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-secondary transition-colors cursor-pointer"
            aria-label="Volgende week"
          >
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Employee selector */}
        <Select value={selectedEmployee} onValueChange={setSelectedEmployee} disabled={isLoadingEmployees}>
          <SelectTrigger className="w-[200px] h-9">
            <SelectValue placeholder={isLoadingEmployees ? 'Laden…' : 'Selecteer medewerker'} />
          </SelectTrigger>
          <SelectContent>
            {employees.map(emp => (
              <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Microsoft status badge */}
        {selectedEmployee && msConnected !== null && (
          <Badge
            variant="outline"
            className={cn(
              'gap-1.5 text-xs font-normal',
              msConnected
                ? 'border-green-200 text-green-700 bg-green-50 dark:border-green-800 dark:text-green-400 dark:bg-green-950/30'
                : 'border-border text-muted-foreground'
            )}
          >
            {msConnected
              ? <><CheckCircle2 className="h-3 w-3" /> Microsoft gekoppeld</>
              : <><XCircle className="h-3 w-3" /> Geen agenda gekoppeld</>
            }
          </Badge>
        )}

        {/* Refresh button */}
        {selectedEmployee && (
          <button
            onClick={() => { fetchCalendarEvents(); fetchPlanningTasks(); }}
            disabled={calendarLoading || tasksLoading}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card hover:bg-secondary transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ml-auto"
            aria-label="Vernieuwen"
          >
            <RefreshCw className={cn('h-4 w-4 text-muted-foreground', (calendarLoading || tasksLoading) && 'animate-spin')} />
          </button>
        )}
      </div>

      {/* ── No employee selected ── */}
      {!selectedEmployee && (
        <div className="rounded-lg border border-dashed border-border bg-card/50 flex flex-col items-center justify-center py-20 gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
            <CalendarDays className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">Selecteer een medewerker</p>
            <p className="text-xs text-muted-foreground mt-1">Kies een medewerker om de agenda en planning te bekijken</p>
          </div>
        </div>
      )}

      {/* ── Content (employee selected) ── */}
      {selectedEmployee && selectedEmployeeData && (
        <Tabs value={activeTab} onValueChange={v => setActiveTab(v as 'agenda' | 'planning')}>
          <div className="flex items-center justify-between gap-4">
            <TabsList className="h-9">
              <TabsTrigger value="agenda" className="text-sm gap-2">
                <CalendarDays className="h-3.5 w-3.5" />
                Microsoft agenda
                {calendarEvents.length > 0 && (
                  <span className="ml-1 rounded-full bg-primary/10 text-primary text-[10px] font-semibold px-1.5 py-0.5">
                    {calendarEvents.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="planning" className="text-sm gap-2">
                <CalendarOff className="h-3.5 w-3.5" />
                Nieuwe planning
                {realTasks.length > 0 && (
                  <span className="ml-1 rounded-full bg-primary/10 text-primary text-[10px] font-semibold px-1.5 py-0.5">
                    {realTasks.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Selection controls */}
            {activeTab === 'agenda' && calendarEvents.length > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => { setIsSelectingAgenda(!isSelectingAgenda); setSelectedAgendaEvents(new Set()); }}
                >
                  {isSelectingAgenda ? 'Annuleren' : 'Selecteren'}
                </Button>
                {isSelectingAgenda && (
                  <>
                    <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setSelectedAgendaEvents(new Set(calendarEvents.map(e => e.id)))}>
                      Alles
                    </Button>
                    <Button variant="destructive" size="sm" className="h-8 text-xs" disabled={selectedAgendaEvents.size === 0}>
                      Verwijder ({selectedAgendaEvents.size})
                    </Button>
                  </>
                )}
              </div>
            )}

            {activeTab === 'planning' && realTasks.length > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => { setIsSelectingPlanning(!isSelectingPlanning); setSelectedPlanTasks(new Set()); }}
                >
                  {isSelectingPlanning ? 'Annuleren' : 'Selecteren'}
                </Button>
                {isSelectingPlanning && (
                  <>
                    <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setSelectedPlanTasks(new Set(realTasks.map(t => t.id)))}>
                      Alles
                    </Button>
                    <Button size="sm" className="h-8 text-xs" disabled={selectedPlanTasks.size === 0}>
                      Toevoegen aan agenda ({selectedPlanTasks.size})
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>

          <TabsContent value="agenda" className="mt-3">
            <AgendaGrid
              weekStart={currentWeekStart}
              employee={selectedEmployeeData}
              events={calendarEvents}
              loading={calendarLoading}
              error={calendarError}
              onRetry={fetchCalendarEvents}
              selectionMode={isSelectingAgenda}
              selectedEvents={selectedAgendaEvents}
              onEventClick={toggleAgendaEvent}
            />
          </TabsContent>

          <TabsContent value="planning" className="mt-3">
            <PlanningGrid
              weekStart={currentWeekStart}
              employee={selectedEmployeeData}
              tasks={realTasks}
              loading={tasksLoading}
              selectionMode={isSelectingPlanning}
              selectedTasks={selectedPlanTasks}
              onTaskClick={togglePlanTask}
            />
          </TabsContent>
        </Tabs>
      )}

      {/* ── Ellen panel (only when data is available) ── */}
      {selectedEmployee && selectedEmployeeData && !calendarLoading && !tasksLoading && (
        <EllenPanel
          employee={selectedEmployeeData}
          weekNumber={weekNumber}
          events={calendarEvents}
          tasks={realTasks}
        />
      )}
    </div>
  );
}
