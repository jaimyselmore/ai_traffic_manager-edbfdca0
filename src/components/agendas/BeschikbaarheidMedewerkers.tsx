import { useState } from 'react';
import { ArrowLeft, Eye, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { mockEmployees, getWeekStart, getWeekNumber, formatDateRange } from '@/lib/mockData';
import { addWeeks, addDays, format } from 'date-fns';
import { nl } from 'date-fns/locale';

interface MicrosoftEvent {
  id: string;
  title: string;
  day: number; // 0-6 (Mon-Sun)
  startHour: number;
  duration: number; // in hours
  week: number;
}

interface BeschikbaarheidMedewerkersProps {
  onBack: () => void;
}

export function BeschikbaarheidMedewerkers({ onBack }: BeschikbaarheidMedewerkersProps) {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getWeekStart(new Date()));
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [weekCount, setWeekCount] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [events, setEvents] = useState<MicrosoftEvent[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);

  const weekNumber = getWeekNumber(currentWeekStart);
  const dateRange = formatDateRange(currentWeekStart);

  const goToCurrentWeek = () => {
    setCurrentWeekStart(getWeekStart(new Date()));
    setEvents([]);
    setHasLoaded(false);
  };

  const handleWeekSelect = (weekNum: string) => {
    const num = parseInt(weekNum, 10);
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const daysOffset = (num - 1) * 7;
    const targetDate = new Date(startOfYear);
    targetDate.setDate(startOfYear.getDate() + daysOffset);
    setCurrentWeekStart(getWeekStart(targetDate));
    setEvents([]);
    setHasLoaded(false);
  };

  const handleShowBeschikbaarheid = async () => {
    if (!selectedEmployee) return;

    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Generate mock Microsoft events
    const mockEvents: MicrosoftEvent[] = [];
    const eventTitles = [
      'Team standup', 'Client call', 'Project review', 'Lunch meeting',
      '1-on-1', 'Sprint planning', 'Design review', 'Focus time'
    ];

    for (let w = 0; w < weekCount; w++) {
      const numEvents = Math.floor(Math.random() * 6) + 3;
      for (let i = 0; i < numEvents; i++) {
        const day = Math.floor(Math.random() * 7);
        const startHour = 8 + Math.floor(Math.random() * 9);
        const duration = Math.random() > 0.5 ? 1 : 2;
        
        mockEvents.push({
          id: `${w}-${i}`,
          title: eventTitles[Math.floor(Math.random() * eventTitles.length)],
          day,
          startHour,
          duration,
          week: w
        });
      }
    }

    setEvents(mockEvents);
    setHasLoaded(true);
    setIsLoading(false);
  };

  const days = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];
  const hours = Array.from({ length: 11 }, (_, i) => 8 + i); // 8:00 - 18:00

  const getEventsForCell = (weekIndex: number, day: number, hour: number) => {
    return events.filter(e => 
      e.week === weekIndex && 
      e.day === day && 
      e.startHour === hour
    );
  };

  const renderWeekCalendar = (weekIndex: number) => {
    const weekStart = addWeeks(currentWeekStart, weekIndex);
    const wn = getWeekNumber(weekStart);

    return (
      <div key={weekIndex} className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="bg-secondary/50 px-4 py-2 border-b border-border">
          <span className="font-semibold text-foreground">Week {wn}</span>
          <span className="ml-2 text-sm text-muted-foreground">
            {format(weekStart, 'd MMM', { locale: nl })} - {format(addDays(weekStart, 6), 'd MMM', { locale: nl })}
          </span>
        </div>
        
        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            {/* Day headers */}
            <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border">
              <div className="p-2 text-xs text-muted-foreground"></div>
              {days.map((day, i) => (
                <div key={day} className="p-2 text-center text-xs font-medium text-foreground border-l border-border">
                  {day}
                </div>
              ))}
            </div>

            {/* Time slots */}
            {hours.map((hour) => (
              <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border last:border-b-0">
                <div className="p-2 text-xs text-muted-foreground text-right pr-3">
                  {hour}:00
                </div>
                {days.map((_, dayIndex) => {
                  const cellEvents = getEventsForCell(weekIndex, dayIndex, hour);
                  return (
                    <div 
                      key={dayIndex} 
                      className="min-h-[40px] border-l border-border p-0.5 relative"
                    >
                      {cellEvents.map((event) => (
                        <div
                          key={event.id}
                          className="absolute inset-x-0.5 bg-primary/20 border border-primary/30 rounded px-1 py-0.5 text-xs text-foreground overflow-hidden"
                          style={{
                            height: `${event.duration * 40 - 4}px`,
                            zIndex: 10
                          }}
                        >
                          <div className="font-medium truncate">{event.title}</div>
                          <div className="text-muted-foreground text-[10px]">
                            {hour}:00 - {hour + event.duration}:00
                          </div>
                        </div>
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
        <h1 className="text-2xl font-bold text-foreground">Beschikbaarheid medewerkers</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Kies een medewerker en periode. We tonen de bestaande Microsoft-afspraken als weekagenda.
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
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Selecteer een medewerker" />
              </SelectTrigger>
              <SelectContent>
                {mockEmployees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.name} – {emp.role}
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
            onClick={handleShowBeschikbaarheid}
            disabled={!selectedEmployee || isLoading}
            className="w-full"
          >
            <Eye className="mr-2 h-4 w-4" />
            {isLoading ? 'Laden...' : 'Toon beschikbaarheid'}
          </Button>
        </div>
      </div>

      {/* Agenda view */}
      {!hasLoaded && !selectedEmployee && (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
          <Calendar className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-muted-foreground">
            Selecteer een medewerker en periode om de Microsoft-agenda te bekijken.
          </p>
        </div>
      )}

      {hasLoaded && (
        <div className={`grid gap-6 ${weekCount === 1 ? '' : weekCount === 2 ? 'lg:grid-cols-2' : weekCount === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2 xl:grid-cols-4'}`}>
          {Array.from({ length: weekCount }, (_, i) => renderWeekCalendar(i))}
        </div>
      )}
    </div>
  );
}
