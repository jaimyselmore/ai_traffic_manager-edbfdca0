import { useState } from 'react';
import { ArrowLeft, Calendar, Upload, Info, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getWeekStart, getWeekNumber, formatDateRange } from '@/lib/mockData';
import { useEmployees } from '@/hooks/use-employees';
import { useClients } from '@/hooks/use-clients';
import { addWeeks, addDays, format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface MicrosoftEvent {
  id: string;
  title: string;
  day: number;
  startHour: number;
  duration: number;
  week: number;
}

interface PlannerTask {
  id: string;
  clientName: string;
  type: string;
  day: number;
  startHour: number;
  duration: number;
  week: number;
  selected: boolean;
}

interface PlanningPlaatsenProps {
  onBack: () => void;
}

export function PlanningPlaatsen({ onBack }: PlanningPlaatsenProps) {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getWeekStart(new Date()));
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [weekCount, setWeekCount] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [microsoftEvents, setMicrosoftEvents] = useState<MicrosoftEvent[]>([]);
  const [plannerTasks, setPlannerTasks] = useState<PlannerTask[]>([]);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  // Fetch employees and clients from Supabase
  const { data: employees = [], isLoading: isLoadingEmployees } = useEmployees();
  const { data: clients = [], isLoading: isLoadingClients } = useClients();

  const weekNumber = getWeekNumber(currentWeekStart);
  const dateRange = formatDateRange(currentWeekStart);

  const goToCurrentWeek = () => {
    setCurrentWeekStart(getWeekStart(new Date()));
    setMicrosoftEvents([]);
    setPlannerTasks([]);
    setHasLoaded(false);
    setSyncResult(null);
  };

  const handleWeekSelect = (weekNum: string) => {
    const num = parseInt(weekNum, 10);
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const daysOffset = (num - 1) * 7;
    const targetDate = new Date(startOfYear);
    targetDate.setDate(startOfYear.getDate() + daysOffset);
    setCurrentWeekStart(getWeekStart(targetDate));
    setMicrosoftEvents([]);
    setPlannerTasks([]);
    setHasLoaded(false);
    setSyncResult(null);
  };

  const handleShowPlanningEnAgenda = async () => {
    if (!selectedEmployee) return;

    setIsLoading(true);
    setSyncResult(null);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Generate mock Microsoft events
    const mockMicrosoft: MicrosoftEvent[] = [];
    const eventTitles = ['Team standup', 'Client call', 'Project review', '1-on-1'];

    for (let w = 0; w < weekCount; w++) {
      const numEvents = Math.floor(Math.random() * 4) + 2;
      for (let i = 0; i < numEvents; i++) {
        const day = Math.floor(Math.random() * 5);
        const startHour = 9 + Math.floor(Math.random() * 7);
        mockMicrosoft.push({
          id: `microsoft-${w}-${i}`,
          title: eventTitles[Math.floor(Math.random() * eventTitles.length)],
          day,
          startHour,
          duration: 1,
          week: w
        });
      }
    }

    // Generate mock planner tasks
    const mockPlanner: PlannerTask[] = [];
    const types = ['Concept', 'Uitwerking', 'Productie', 'Review'];

    for (let w = 0; w < weekCount; w++) {
      const numTasks = Math.floor(Math.random() * 5) + 3;
      for (let i = 0; i < numTasks; i++) {
        const day = Math.floor(Math.random() * 5);
        const startHour = 9 + Math.floor(Math.random() * 7);
        const client = clients.length > 0 
          ? clients[Math.floor(Math.random() * clients.length)] 
          : { name: 'Onbekend' };
        mockPlanner.push({
          id: `task-${w}-${i}`,
          clientName: client.name,
          type: types[Math.floor(Math.random() * types.length)],
          day,
          startHour,
          duration: Math.random() > 0.5 ? 1 : 2,
          week: w,
          selected: false
        });
      }
    }

    setMicrosoftEvents(mockMicrosoft);
    setPlannerTasks(mockPlanner);
    setHasLoaded(true);
    setIsLoading(false);
  };

  const toggleTaskSelection = (taskId: string) => {
    setPlannerTasks(prev =>
      prev.map(task =>
        task.id === taskId ? { ...task, selected: !task.selected } : task
      )
    );
  };

  const handleSyncToMicrosoft = async () => {
    const selectedTasks = plannerTasks.filter(t => t.selected);
    if (selectedTasks.length === 0) return;

    setIsSyncing(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Mock sync - check for conflicts
    let synced = 0;
    let conflicts = 0;

    selectedTasks.forEach(task => {
      const hasConflict = microsoftEvents.some(
        e => e.week === task.week && e.day === task.day && e.startHour === task.startHour
      );
      if (hasConflict) {
        conflicts++;
      } else {
        synced++;
      }
    });

    const employee = employees.find(e => e.id === selectedEmployee);
    if (conflicts > 0) {
      setSyncResult(`${synced} blokken geplaatst voor ${employee?.name}. ${conflicts} overgeslagen wegens conflicten.`);
    } else {
      setSyncResult(`${synced} blokken succesvol geplaatst in de Microsoft-agenda van ${employee?.name}.`);
    }

    // Deselect synced tasks
    setPlannerTasks(prev => prev.map(t => ({ ...t, selected: false })));
    setIsSyncing(false);
  };

  const days = ['Ma', 'Di', 'Wo', 'Do', 'Vr'];
  const hours = Array.from({ length: 9 }, (_, i) => 9 + i); // 9:00 - 17:00

  const selectedCount = plannerTasks.filter(t => t.selected).length;

  const renderWeekCalendar = (weekIndex: number) => {
    const weekStart = addWeeks(currentWeekStart, weekIndex);
    const wn = getWeekNumber(weekStart);

    const getMicrosoftEventsForCell = (day: number, hour: number) => {
      return microsoftEvents.filter(e => e.week === weekIndex && e.day === day && e.startHour === hour);
    };

    const getPlannerTasksForCell = (day: number, hour: number) => {
      return plannerTasks.filter(t => t.week === weekIndex && t.day === day && t.startHour === hour);
    };

    return (
      <div key={weekIndex} className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="bg-secondary/50 px-4 py-2 border-b border-border">
          <span className="font-semibold text-foreground">Week {wn}</span>
          <span className="ml-2 text-sm text-muted-foreground">
            {format(weekStart, 'd MMM', { locale: nl })} - {format(addDays(weekStart, 4), 'd MMM', { locale: nl })}
          </span>
        </div>
        
        <div className="overflow-x-auto">
          <div className="min-w-[500px]">
            {/* Day headers */}
            <div className="grid grid-cols-[60px_repeat(5,1fr)] border-b border-border">
              <div className="p-2 text-xs text-muted-foreground"></div>
              {days.map((day) => (
                <div key={day} className="p-2 text-center text-xs font-medium text-foreground border-l border-border">
                  {day}
                </div>
              ))}
            </div>

            {/* Time slots */}
            {hours.map((hour) => (
              <div key={hour} className="grid grid-cols-[60px_repeat(5,1fr)] border-b border-border last:border-b-0">
                <div className="p-2 text-xs text-muted-foreground text-right pr-3">
                  {hour}:00
                </div>
                {days.map((_, dayIndex) => {
                  const microsoftEvts = getMicrosoftEventsForCell(dayIndex, hour);
                  const plannerTsks = getPlannerTasksForCell(dayIndex, hour);
                  
                  return (
                    <div 
                      key={dayIndex} 
                      className="min-h-[50px] border-l border-border p-0.5 relative"
                    >
                      {/* Microsoft events (grey/blue) */}
                      {microsoftEvts.map((event) => (
                        <div
                          key={event.id}
                          className="absolute inset-x-0.5 bg-muted border border-border rounded px-1 py-0.5 text-xs text-muted-foreground overflow-hidden z-10"
                          style={{ height: `${event.duration * 50 - 4}px` }}
                        >
                          <div className="truncate">{event.title}</div>
                        </div>
                      ))}
                      
                      {/* Planner tasks (colored, selectable) */}
                      {plannerTsks.map((task) => (
                        <button
                          key={task.id}
                          onClick={() => toggleTaskSelection(task.id)}
                          className={cn(
                            "absolute inset-x-0.5 rounded px-1 py-0.5 text-xs overflow-hidden text-left transition-all",
                            task.selected
                              ? "bg-primary border-2 border-primary text-primary-foreground z-20"
                              : "bg-primary/20 border border-primary/30 text-foreground hover:bg-primary/30 z-15"
                          )}
                          style={{ 
                            height: `${task.duration * 50 - 4}px`,
                            top: microsoftEvts.length > 0 ? '2px' : undefined
                          }}
                        >
                          <div className="flex items-center gap-1">
                            {task.selected && <Check className="h-3 w-3 flex-shrink-0" />}
                            <span className="font-medium truncate">{task.clientName}</span>
                          </div>
                          <div className={cn("text-[10px]", task.selected ? "text-primary-foreground/80" : "text-muted-foreground")}>
                            {task.type}
                          </div>
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Back link */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Terug naar agenda-overzicht
      </button>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Planning plaatsen in Microsoft-agenda's</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Kies een medewerker en periode. Selecteer planningsblokken om in de Microsoft-agenda te zetten.
        </p>
      </div>

      {/* Filters card */}
      <div className="rounded-xl border border-border bg-card p-6 max-w-xl">
        <div className="space-y-4">
          {/* Week navigation */}
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={goToCurrentWeek}>
              Huidige week
            </Button>
            <span className="text-sm text-muted-foreground">Ga naar week:</span>
            <Select value={String(weekNumber)} onValueChange={handleWeekSelect}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {Array.from({ length: 52 }, (_, i) => i + 1).map((week) => (
                  <SelectItem key={week} value={String(week)}>
                    {week}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Employee selector */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground w-24">Medewerker:</span>
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee} disabled={isLoadingEmployees}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder={isLoadingEmployees ? "Laden..." : "Selecteer een medewerker"} />
              </SelectTrigger>
              <SelectContent>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.name} – {emp.role || 'Geen rol'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Week count */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground w-24">Aantal weken:</span>
            <Select value={String(weekCount)} onValueChange={(v) => setWeekCount(Number(v))}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1</SelectItem>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="3">3</SelectItem>
                <SelectItem value="4">4</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Action button */}
          <Button
            onClick={handleShowPlanningEnAgenda}
            disabled={!selectedEmployee || isLoading}
            className="w-full"
          >
            <Calendar className="mr-2 h-4 w-4" />
            {isLoading ? 'Laden...' : 'Toon planning en agenda'}
          </Button>
        </div>
      </div>

      {/* Calendar view + sync panel */}
      {!hasLoaded && (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
          <Calendar className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-muted-foreground">
            Selecteer een medewerker en periode om de planning en Microsoft-agenda te bekijken.
          </p>
        </div>
      )}

      {hasLoaded && (
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          {/* Calendars */}
          <div className={`grid gap-6 ${weekCount === 1 ? '' : weekCount === 2 ? 'xl:grid-cols-2' : 'xl:grid-cols-2'}`}>
            {Array.from({ length: weekCount }, (_, i) => renderWeekCalendar(i))}
          </div>

          {/* Sync panel */}
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="font-semibold text-foreground mb-4">Plaatsen in Microsoft-agenda's</h3>
              
              <div className="mb-4">
                <div className="text-sm text-muted-foreground">
                  {selectedCount === 0 
                    ? 'Klik op planningsblokken om ze te selecteren.'
                    : `${selectedCount} blok${selectedCount === 1 ? '' : 'ken'} geselecteerd`
                  }
                </div>
              </div>

              <Button
                onClick={handleSyncToMicrosoft}
                disabled={selectedCount === 0 || isSyncing}
                className="w-full mb-4"
              >
                <Upload className="mr-2 h-4 w-4" />
                {isSyncing ? 'Plaatsen...' : 'Plaats selectie in Microsoft-agenda'}
              </Button>

              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex items-start gap-2">
                  <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <span>We vullen alleen vrije tijdsloten.</span>
                </div>
                <div className="flex items-start gap-2">
                  <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <span>Bestaande Microsoft-afspraken worden niet overschreven.</span>
                </div>
                <div className="flex items-start gap-2">
                  <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <span>Alleen geselecteerde planningsblokken worden geplaatst.</span>
                </div>
              </div>

              {syncResult && (
                <div className="mt-4 p-3 rounded-lg bg-success/10 text-success text-xs">
                  <Check className="inline-block h-3 w-3 mr-1" />
                  {syncResult}
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="rounded-xl border border-border bg-card p-4">
              <h4 className="text-sm font-medium text-foreground mb-2">Legenda</h4>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-muted border border-border"></div>
                  <span className="text-muted-foreground">Bestaande Microsoft-afspraak</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-primary/20 border border-primary/30"></div>
                  <span className="text-muted-foreground">Planningsblok</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-primary border-2 border-primary"></div>
                  <span className="text-muted-foreground">Geselecteerd</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
