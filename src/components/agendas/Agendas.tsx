import { useState } from 'react';
import { Upload, Check, AlertCircle, Calendar, Eye, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { mockEmployees, getWeekStart, getWeekNumber, formatDateRange } from '@/lib/mockData';
import { cn } from '@/lib/utils';
import { addWeeks, format } from 'date-fns';
import { nl } from 'date-fns/locale';

interface StatusMessage {
  type: 'success' | 'info' | 'error' | 'warning';
  message: string;
  timestamp: Date;
}

interface OutlookEvent {
  id: string;
  employeeId: string;
  title: string;
  startTime: string;
  endTime: string;
  week: number;
}

export function Agendas() {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getWeekStart(new Date()));
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusMessages, setStatusMessages] = useState<StatusMessage[]>([]);
  const [viewWeekCount, setViewWeekCount] = useState<number>(1);
  const [outlookEvents, setOutlookEvents] = useState<OutlookEvent[]>([]);
  const [hasViewedEvents, setHasViewedEvents] = useState(false);

  const weekNumber = getWeekNumber(currentWeekStart);
  const dateRange = formatDateRange(currentWeekStart);

  // Week navigation helpers
  const goToCurrentWeek = () => {
    const now = new Date();
    setCurrentWeekStart(getWeekStart(now));
    setOutlookEvents([]);
    setHasViewedEvents(false);
  };

  const handleWeekSelect = (weekNum: string) => {
    const weekNumber = parseInt(weekNum, 10);
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const daysOffset = (weekNumber - 1) * 7;
    const targetDate = new Date(startOfYear);
    targetDate.setDate(startOfYear.getDate() + daysOffset);
    setCurrentWeekStart(getWeekStart(targetDate));
    setOutlookEvents([]);
    setHasViewedEvents(false);
  };

  const toggleEmployee = (employeeId: string) => {
    setSelectedEmployees((prev) =>
      prev.includes(employeeId)
        ? prev.filter((id) => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const toggleAll = () => {
    if (selectedEmployees.length === mockEmployees.length) {
      setSelectedEmployees([]);
    } else {
      setSelectedEmployees(mockEmployees.map((emp) => emp.id));
    }
  };

  const addStatusMessage = (type: StatusMessage['type'], message: string) => {
    setStatusMessages(prev => [
      { type, message, timestamp: new Date() },
      ...prev.slice(0, 9) // Keep last 10 messages
    ]);
  };

  const handleViewOutlookEvents = async () => {
    if (selectedEmployees.length === 0) {
      addStatusMessage('error', 'Selecteer minimaal één medewerker');
      return;
    }

    setIsLoading(true);
    addStatusMessage('info', 'Outlook-agenda\'s ophalen...');

    // Mock API call
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Generate mock Outlook events for selected employees
    const mockEvents: OutlookEvent[] = [];
    const eventTitles = [
      'Team standup', 'Client call', 'Project review', 'Lunch meeting',
      '1-on-1', 'Sprint planning', 'Design review', 'Coffee break'
    ];

    const displayedEmployees = selectedEmployees.slice(0, 10);
    
    displayedEmployees.forEach(empId => {
      for (let w = 0; w < viewWeekCount; w++) {
        const weekStart = addWeeks(currentWeekStart, w);
        const numEvents = Math.floor(Math.random() * 4) + 1;
        
        for (let i = 0; i < numEvents; i++) {
          const day = Math.floor(Math.random() * 5);
          const hour = 9 + Math.floor(Math.random() * 8);
          mockEvents.push({
            id: `${empId}-${w}-${i}`,
            employeeId: empId,
            title: eventTitles[Math.floor(Math.random() * eventTitles.length)],
            startTime: `${String(hour).padStart(2, '0')}:00`,
            endTime: `${String(hour + 1).padStart(2, '0')}:00`,
            week: getWeekNumber(weekStart)
          });
        }
      }
    });

    setOutlookEvents(mockEvents);
    setHasViewedEvents(true);

    const weekRangeText = viewWeekCount === 1 
      ? `Week ${weekNumber}` 
      : `Week ${weekNumber}–${weekNumber + viewWeekCount - 1}`;
    
    addStatusMessage('success', 
      `Outlook-agenda's opgehaald voor ${displayedEmployees.length} medewerker(s) (${weekRangeText}).`
    );
    setIsLoading(false);
  };

  const handleSyncToOutlook = async () => {
    if (selectedEmployees.length === 0) {
      addStatusMessage('error', 'Selecteer minimaal één medewerker');
      return;
    }

    setIsSyncing(true);
    addStatusMessage('info', 'Planning synchroniseren naar Outlook...');

    // Mock API call
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Mock sync results with some conflicts
    let totalSynced = 0;
    let totalConflicts = 0;

    selectedEmployees.forEach(empId => {
      const employee = mockEmployees.find(e => e.id === empId);
      const synced = Math.floor(Math.random() * 5) + 1;
      const conflicts = Math.floor(Math.random() * 3);
      
      totalSynced += synced;
      totalConflicts += conflicts;

      if (synced > 0) {
        addStatusMessage('success', `${synced} afspraken gesynchroniseerd voor ${employee?.name}.`);
      }
      if (conflicts > 0) {
        addStatusMessage('warning', `${conflicts} conflicten voor ${employee?.name} (bestaande Outlook-afspraken).`);
      }
    });

    if (totalConflicts > 0) {
      addStatusMessage('info', `Totaal: ${totalSynced} gesynchroniseerd, ${totalConflicts} overgeslagen wegens conflicten.`);
    }

    setIsSyncing(false);
  };

  const getEmployeeEvents = (employeeId: string, week: number) => {
    return outlookEvents.filter(e => e.employeeId === employeeId && e.week === week);
  };

  const displayedEmployeesForView = selectedEmployees.slice(0, 10);
  const hasMoreThan10 = selectedEmployees.length > 10;

  return (
    <div className="space-y-6">
      {/* Header with Week Info */}
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-2xl font-bold text-foreground">Week {weekNumber}</span>
          <span className="text-lg text-muted-foreground">– {dateRange}</span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Bekijk bestaande Outlook-afspraken en synchroniseer de planning voor deze week.
        </p>
      </div>

      {/* Week Navigation */}
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

      {/* Main Grid: 3 columns */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Card: Medewerkers */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Medewerkers</h2>
            <Button variant="ghost" size="sm" onClick={toggleAll}>
              {selectedEmployees.length === mockEmployees.length ? 'Deselecteer alles' : 'Selecteer alles'}
            </Button>
          </div>

          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {mockEmployees.map((employee) => (
              <label
                key={employee.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-secondary"
              >
                <Checkbox
                  checked={selectedEmployees.includes(employee.id)}
                  onCheckedChange={() => toggleEmployee(employee.id)}
                />
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                  {employee.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground truncate">{employee.name}</div>
                  <div className="text-sm text-muted-foreground">{employee.role}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Middle Card: Outlook-agenda's */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-2 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Outlook-agenda's</h2>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            Toon bestaande afspraken uit Outlook voor de geselecteerde medewerkers.
          </p>

          <div className="space-y-3">
            <Button
              className="w-full"
              variant="outline"
              onClick={handleViewOutlookEvents}
              disabled={isLoading || selectedEmployees.length === 0}
            >
              <Eye className={cn('mr-2 h-4 w-4', isLoading && 'animate-pulse')} />
              {isLoading ? 'Laden...' : 'Bekijk Outlook-agenda\'s'}
            </Button>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Toon weken:</span>
              <Select value={String(viewWeekCount)} onValueChange={(v) => setViewWeekCount(Number(v))}>
                <SelectTrigger className="w-16">
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
          </div>

          {/* Outlook Events Preview */}
          {hasViewedEvents && displayedEmployeesForView.length > 0 && (
            <div className="mt-4 border-t border-border pt-4">
              <div className="text-sm font-medium text-foreground mb-2">
                Afspraken overzicht
              </div>
              
              {hasMoreThan10 && (
                <p className="text-xs text-warning mb-2">
                  Toon maximaal 10 medewerkers tegelijk voor dit overzicht.
                </p>
              )}

              <div className="space-y-3 max-h-[200px] overflow-y-auto">
                {displayedEmployeesForView.map(empId => {
                  const employee = mockEmployees.find(e => e.id === empId);
                  return (
                    <div key={empId} className="text-xs">
                      <div className="font-medium text-foreground mb-1">{employee?.name}</div>
                      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${viewWeekCount}, 1fr)` }}>
                        {Array.from({ length: viewWeekCount }, (_, w) => {
                          const week = weekNumber + w;
                          const events = getEmployeeEvents(empId, week);
                          return (
                            <div key={w} className="bg-secondary/50 rounded p-1">
                              <div className="text-muted-foreground mb-0.5">Wk {week}</div>
                              {events.length === 0 ? (
                                <span className="text-muted-foreground/60">Geen</span>
                              ) : (
                                events.slice(0, 3).map(evt => (
                                  <div key={evt.id} className="truncate text-foreground">
                                    {evt.startTime} {evt.title}
                                  </div>
                                ))
                              )}
                              {events.length > 3 && (
                                <div className="text-muted-foreground">+{events.length - 3} meer</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Acties + Status */}
        <div className="space-y-6">
          {/* Acties Card */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Acties</h2>
            
            <Button
              className="w-full mb-4"
              onClick={handleSyncToOutlook}
              disabled={isSyncing || selectedEmployees.length === 0}
            >
              <Upload className={cn('mr-2 h-4 w-4', isSyncing && 'animate-pulse')} />
              {isSyncing ? 'Synchroniseren...' : 'Sync planning naar Outlook'}
            </Button>

            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex items-start gap-2">
                <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span>We plannen alleen in vrije tijdsloten.</span>
              </div>
              <div className="flex items-start gap-2">
                <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span>Bestaande Outlook-afspraken worden niet overschreven.</span>
              </div>
              <div className="flex items-start gap-2">
                <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span>We synchroniseren alleen taken met status 'bevestigd' in de planner.</span>
              </div>
            </div>
          </div>

          {/* Status Card */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Status</h2>
            {statusMessages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Geen recente activiteit. Selecteer medewerkers en start een actie.
              </p>
            ) : (
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {statusMessages.map((status, index) => (
                  <div
                    key={index}
                    className={cn(
                      'flex items-start gap-2 rounded-lg p-2 text-xs',
                      status.type === 'success' && 'bg-success/10 text-success',
                      status.type === 'info' && 'bg-primary/10 text-primary',
                      status.type === 'error' && 'bg-destructive/10 text-destructive',
                      status.type === 'warning' && 'bg-warning/10 text-warning'
                    )}
                  >
                    {status.type === 'success' && <Check className="mt-0.5 h-3 w-3 flex-shrink-0" />}
                    {status.type === 'info' && <Info className="mt-0.5 h-3 w-3 flex-shrink-0" />}
                    {status.type === 'error' && <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0" />}
                    {status.type === 'warning' && <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0" />}
                    <span>{status.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
