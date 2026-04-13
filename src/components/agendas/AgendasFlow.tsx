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
import { getWeekStart, getWeekNumber, formatDateRange, toLocalDateString } from '@/lib/helpers/dateHelpers';
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
  X,
  Pencil,
  MapPin,
  User,
  Users,
  ExternalLink,
  Check,
  Clock,
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

// ── Event Detail Types ────────────────────────────────────────────────────────

interface AgendaEventDetail {
  id: string;
  title: string;
  start: string | null;
  end: string | null;
  isAllDay: boolean;
  location: string | null;
  webLink: string | null;
  organizer: { name: string; email: string };
  attendees: Array<{ name: string; email: string; status: string; type: string }>;
  body: string;
  categories: string[];
}

// ── Event Detail Panel ────────────────────────────────────────────────────────

const statusIcon = (status: string) => {
  if (status === 'accepted') return <Check className="h-3 w-3 text-green-500" />;
  if (status === 'declined') return <X className="h-3 w-3 text-red-400" />;
  if (status === 'tentative') return <Clock className="h-3 w-3 text-amber-400" />;
  return <span className="h-3 w-3 rounded-full border border-muted-foreground/40 inline-block" />;
};

const statusLabel: Record<string, string> = {
  accepted: 'Geaccepteerd', declined: 'Geweigerd', tentative: 'Misschien', none: 'Geen reactie',
};

function formatEventTime(start: string | null, end: string | null, isAllDay: boolean): string {
  if (isAllDay) return 'Hele dag';
  if (!start) return '';
  const d = new Date(start);
  const dayNames = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
  const day = `${dayNames[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  const startT = start.substring(11, 16);
  const endT = end ? end.substring(11, 16) : '';
  return `${day}  ${startT}${endT ? ` – ${endT}` : ''}`;
}

interface EventDetailPanelProps {
  detail: AgendaEventDetail | null;
  loading: boolean;
  werknemerId: string;
  onClose: () => void;
  onSaved: () => void;
}

function EventDetailPanel({ detail, loading, werknemerId, onClose, onSaved }: EventDetailPanelProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Edit form state
  const [editTitle, setEditTitle] = useState('');
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editBody, setEditBody] = useState('');

  useEffect(() => {
    if (detail) {
      setEditTitle(detail.title);
      setEditStart(detail.start ? detail.start.substring(0, 16) : '');
      setEditEnd(detail.end ? detail.end.substring(0, 16) : '');
      setEditLocation(detail.location || '');
      setEditBody(detail.body || '');
      setEditing(false);
      setSaveError('');
    }
  }, [detail?.id]);

  const handleSave = async () => {
    if (!detail) return;
    setSaving(true);
    setSaveError('');
    try {
      const { data, error } = await supabase.functions.invoke('update-calendar-event', {
        body: {
          werknemerId,
          eventId: detail.id,
          updates: {
            subject: editTitle,
            startDateTime: editStart ? editStart + ':00' : undefined,
            endDateTime: editEnd ? editEnd + ':00' : undefined,
            location: editLocation,
            body: editBody,
          },
        },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      setEditing(false);
      onSaved();
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Opslaan mislukt');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed right-0 top-0 h-full w-[380px] max-w-full z-50 flex flex-col bg-card border-l border-border shadow-xl transition-transform">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
        <span className="text-sm font-semibold text-foreground">Afspraakdetails</span>
        <div className="flex items-center gap-2">
          {detail && !editing && (
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditing(true)} title="Bewerken">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {loading && (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Laden…</span>
          </div>
        )}

        {!loading && detail && !editing && (
          <>
            {/* Title + time */}
            <div>
              <h2 className="text-base font-semibold text-foreground leading-snug mb-1.5">{detail.title}</h2>
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <Clock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>{formatEventTime(detail.start, detail.end, detail.isAllDay)}</span>
              </div>
              {detail.location && (
                <div className="flex items-start gap-2 text-sm text-muted-foreground mt-1.5">
                  <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>{detail.location}</span>
                </div>
              )}
            </div>

            {/* Organizer */}
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Organisator</div>
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                  {detail.organizer.name.charAt(0).toUpperCase() || <User className="h-3.5 w-3.5" />}
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground">{detail.organizer.name || '—'}</div>
                  <div className="text-[11px] text-muted-foreground">{detail.organizer.email}</div>
                </div>
              </div>
            </div>

            {/* Attendees */}
            {detail.attendees.length > 0 && (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  Deelnemers ({detail.attendees.length})
                </div>
                <div className="space-y-2">
                  {detail.attendees.map((a, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <div className="h-6 w-6 rounded-full bg-secondary text-muted-foreground flex items-center justify-center text-[10px] font-semibold shrink-0">
                        {a.name.charAt(0).toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-foreground truncate">{a.name || a.email}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{a.email}</div>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0" title={statusLabel[a.status] || a.status}>
                        {statusIcon(a.status)}
                        <span className="hidden sm:inline">{statusLabel[a.status] || a.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Body */}
            {detail.body && (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Beschrijving</div>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap line-clamp-6">{detail.body}</p>
              </div>
            )}

            {/* Open in Outlook */}
            {detail.webLink && (
              <a
                href={detail.webLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                Openen in Outlook
              </a>
            )}
          </>
        )}

        {/* Edit form */}
        {!loading && detail && editing && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Titel</label>
              <input
                type="text"
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Begintijd</label>
                <input
                  type="datetime-local"
                  value={editStart}
                  onChange={e => setEditStart(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Eindtijd</label>
                <input
                  type="datetime-local"
                  value={editEnd}
                  onChange={e => setEditEnd(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Locatie</label>
              <input
                type="text"
                value={editLocation}
                onChange={e => setEditLocation(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Beschrijving</label>
              <textarea
                value={editBody}
                onChange={e => setEditBody(e.target.value)}
                rows={4}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>
            {saveError && <p className="text-xs text-destructive">{saveError}</p>}
          </div>
        )}
      </div>

      {/* Edit footer */}
      {editing && (
        <div className="shrink-0 px-5 py-3 border-t border-border flex gap-2 bg-card">
          <Button size="sm" onClick={handleSave} disabled={saving} className="flex-1">
            {saving ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Opslaan…</> : 'Opslaan'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setEditing(false); setSaveError(''); }}>
            Annuleren
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Calendar layout constants ─────────────────────────────────────────────────

const ROW_HEIGHT = 48; // px per hour
const GRID_START = 8;  // first visible hour
const GRID_END = 19;   // exclusive (shows up to 18:xx)
const TOTAL_HEIGHT = (GRID_END - GRID_START) * ROW_HEIGHT;
const TIME_COL_WIDTH = 56; // px

/** Parse "HH:MM" → total minutes */
const parseMinutes = (t: string): number => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
};

/** Assign non-overlapping columns to events and return layout info */
function layoutEvents<T extends { startTime: string | null; endTime: string | null; id: string }>(
  items: T[]
): Array<{ item: T; col: number; colCount: number }> {
  if (items.length === 0) return [];
  const sorted = [...items].sort(
    (a, b) => parseMinutes(a.startTime ?? '08:00') - parseMinutes(b.startTime ?? '08:00')
  );
  const cols: { item: T; col: number; endMin: number }[] = [];
  const colEnds: number[] = [];

  for (const item of sorted) {
    const start = parseMinutes(item.startTime ?? '08:00');
    const end = parseMinutes(item.endTime ?? '09:00');
    let col = 0;
    while (col < colEnds.length && colEnds[col] > start) col++;
    colEnds[col] = end;
    cols.push({ item, col, endMin: end });
  }

  return cols.map(({ item, col, endMin }) => {
    const start = parseMinutes(item.startTime ?? '08:00');
    const overlapping = cols.filter(
      o => parseMinutes(o.item.startTime ?? '08:00') < endMin && o.endMin > start
    );
    const colCount = Math.max(...overlapping.map(o => o.col)) + 1;
    return { item, col, colCount };
  });
}

/** Shared calendar column layout (time column + 5 day columns) */
function CalendarLayout({
  weekDates,
  renderDayContent,
  allDayRow,
}: {
  weekDates: Date[];
  renderDayContent: (date: Date, di: number) => React.ReactNode;
  allDayRow?: (date: Date, di: number) => React.ReactNode;
}) {
  const hours = Array.from({ length: GRID_END - GRID_START }, (_, i) => GRID_START + i);

  return (
    <div className="rounded-lg border border-border bg-card overflow-auto">
      <div style={{ minWidth: 640 }}>
        {/* Column headers */}
        <div
          className="grid border-b border-border bg-secondary/60"
          style={{ gridTemplateColumns: `${TIME_COL_WIDTH}px repeat(5, 1fr)` }}
        >
          <div className="px-2 py-2.5" />
          {weekDates.map((date, i) => (
            <div
              key={i}
              className="border-l border-border px-3 py-2.5 text-center text-xs font-medium text-foreground"
            >
              <span className="font-semibold">{dayNames[i]}</span>
              <span className="ml-1 font-normal text-muted-foreground">
                {date.getDate()}/{date.getMonth() + 1}
              </span>
            </div>
          ))}
        </div>

        {/* All-day row (optional) */}
        {allDayRow && (
          <div
            className="grid border-b border-border"
            style={{ gridTemplateColumns: `${TIME_COL_WIDTH}px repeat(5, 1fr)` }}
          >
            <div className="px-2 flex items-center justify-end text-[10px] text-muted-foreground pr-2 py-1">
              all-day
            </div>
            {weekDates.map((date, di) => (
              <div key={di} className="border-l border-border px-1 py-1 min-h-[28px]">
                {allDayRow(date, di)}
              </div>
            ))}
          </div>
        )}

        {/* Time grid */}
        <div
          className="grid"
          style={{
            gridTemplateColumns: `${TIME_COL_WIDTH}px repeat(5, 1fr)`,
            height: TOTAL_HEIGHT,
          }}
        >
          {/* Time labels */}
          <div className="relative border-r border-border">
            {hours.map(h => (
              <div
                key={h}
                className="absolute right-2 text-[10px] text-muted-foreground select-none"
                style={{ top: h === GRID_START ? 2 : (h - GRID_START) * ROW_HEIGHT - 7 }}
              >
                {h}:00
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDates.map((date, di) => (
            <div key={di} className="border-l border-border relative">
              {/* Hour grid lines */}
              {hours.map(h => (
                <div
                  key={h}
                  className="absolute w-full border-t border-border/40 pointer-events-none"
                  style={{ top: (h - GRID_START) * ROW_HEIGHT }}
                />
              ))}
              {/* Noon highlight */}
              <div
                className="absolute w-full border-t border-border pointer-events-none"
                style={{ top: (12 - GRID_START) * ROW_HEIGHT }}
              />
              {/* Content */}
              {renderDayContent(date, di)}
            </div>
          ))}
        </div>
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
  onEventDetail: (id: string) => void;
}

function AgendaGrid({ weekStart, employee, events, loading, error, onRetry, selectionMode, selectedEvents, onEventClick, onEventDetail }: AgendaGridProps) {
  const weekDates = useMemo(() =>
    dayNames.map((_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    }), [weekStart]);

  const getTimedEventsForDay = (date: Date) => {
    const dateStr = toLocalDateString(date);
    return events.filter(ev => ev.date === dateStr && !ev.isAllDay && !!ev.startTime && !!ev.endTime);
  };

  const getAllDayEventsForDay = (date: Date) => {
    const dateStr = toLocalDateString(date);
    return events.filter(ev => ev.date === dateStr && (ev.isAllDay || (!ev.startTime && !ev.endTime)));
  };

  const hasAllDay = weekDates.some(d => getAllDayEventsForDay(d).length > 0);

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
    <CalendarLayout
      weekDates={weekDates}
      allDayRow={hasAllDay ? (date) => {
        const allDay = getAllDayEventsForDay(date);
        return allDay.map(ev => (
          <div key={ev.id} className="rounded px-1.5 py-0.5 text-[10px] font-medium text-white bg-slate-400 truncate mb-0.5">
            {ev.title}
          </div>
        ));
      } : undefined}
      renderDayContent={(date) => {
        const dayEvents = getTimedEventsForDay(date);
        const laid = layoutEvents(dayEvents);
        return laid.map(({ item: ev, col, colCount }) => {
          const startMin = parseMinutes(ev.startTime!);
          const endMin = parseMinutes(ev.endTime!);
          const clampedStart = Math.max(startMin, GRID_START * 60);
          const clampedEnd = Math.min(endMin, GRID_END * 60);
          const top = ((clampedStart - GRID_START * 60) / 60) * ROW_HEIGHT;
          const height = Math.max(((clampedEnd - clampedStart) / 60) * ROW_HEIGHT - 2, 20);
          const widthPct = 100 / colCount;
          const isSelected = selectedEvents.has(ev.id);
          const showTime = height >= 32;
          const showLocation = height >= 52 && ev.location;

          return (
            <div
              key={ev.id}
              onClick={() => selectionMode ? onEventClick(ev.id) : onEventDetail(ev.id)}
              className={cn(
                'absolute rounded px-1.5 py-1 text-[11px] font-medium text-white bg-slate-500 overflow-hidden transition-all leading-tight cursor-pointer hover:brightness-110',
                selectionMode && 'hover:ring-2 hover:ring-primary ring-offset-1',
                isSelected && 'ring-2 ring-blue-500 ring-offset-1',
              )}
              style={{
                top: top + 1,
                height,
                left: `calc(${col * widthPct}% + 2px)`,
                width: `calc(${widthPct}% - 4px)`,
                zIndex: 10,
              }}
              title={`${ev.title}${ev.location ? ` · ${ev.location}` : ''}\n${ev.startTime} – ${ev.endTime}`}
            >
              {showTime && (
                <div className="text-[10px] opacity-75 mb-0.5">{ev.startTime}</div>
              )}
              <div className="truncate font-semibold">{ev.title}</div>
              {showLocation && (
                <div className="truncate text-[10px] opacity-70">{ev.location}</div>
              )}
            </div>
          );
        });
      }}
    />
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

  const taskLabel: Record<string, string> = {
    concept: 'Concept', review: 'Review', uitwerking: 'Uitwerking',
    productie: 'Productie', extern: 'Extern', optie: 'Optie',
  };

  const getTasksForDay = (date: Date) => {
    const dateStr = toLocalDateString(date);
    return tasks.filter(t => t.date === dateStr);
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
    <CalendarLayout
      weekDates={weekDates}
      renderDayContent={(date) => {
        const dayTasks = getTasksForDay(date);
        const laid = layoutEvents(dayTasks);
        return laid.map(({ item: task, col, colCount }) => {
          const startMin = parseMinutes(task.startTime);
          const endMin = parseMinutes(task.endTime);
          const clampedStart = Math.max(startMin, GRID_START * 60);
          const clampedEnd = Math.min(endMin, GRID_END * 60);
          const top = ((clampedStart - GRID_START * 60) / 60) * ROW_HEIGHT;
          const height = Math.max(((clampedEnd - clampedStart) / 60) * ROW_HEIGHT - 2, 20);
          const widthPct = 100 / colCount;
          const isSelected = selectedTasks.has(task.id);
          const showLabel = height >= 38;

          return (
            <div
              key={task.id}
              onClick={() => onTaskClick(task.id)}
              className={cn(
                'absolute rounded px-1.5 py-1 text-[11px] text-white overflow-hidden transition-all leading-tight cursor-default',
                taskColors[task.type] || 'bg-[hsl(var(--task-concept))]',
                selectionMode && 'cursor-pointer hover:ring-2 hover:ring-primary ring-offset-1',
                isSelected && 'ring-2 ring-blue-500 ring-offset-1',
              )}
              style={{
                top: top + 1,
                height,
                left: `calc(${col * widthPct}% + 2px)`,
                width: `calc(${widthPct}% - 4px)`,
                zIndex: 10,
              }}
              title={`${task.clientName} · ${taskLabel[task.type] || task.type}\n${task.startTime} – ${task.endTime}`}
            >
              <div className="truncate font-semibold">{task.clientName}</div>
              {showLabel && (
                <div className="truncate text-[10px] opacity-80">{taskLabel[task.type] || task.type}</div>
              )}
            </div>
          );
        });
      }}
    />
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

  // Push planning to calendar
  const [isPushing, setIsPushing] = useState(false);
  const [pushResult, setPushResult] = useState<{ succeeded: number; failed: number } | null>(null);

  // Event detail panel
  const [detailEventId, setDetailEventId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<AgendaEventDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

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
    const weekStartStr = toLocalDateString(currentWeekStart);
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
    const weekStartStr = toLocalDateString(currentWeekStart);
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
          const dateStr = toLocalDateString(date);
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

  const handleEventDetail = async (eventId: string) => {
    setDetailEventId(eventId);
    setDetailData(null);
    setDetailLoading(true);
    const { data, error } = await supabase.functions.invoke('get-event-details', {
      body: { werknemerId: selectedEmployee, eventId },
    });
    if (!error && data && !data.error) {
      setDetailData(data as AgendaEventDetail);
    }
    setDetailLoading(false);
  };

  const handlePushToCalendar = async () => {
    if (!selectedEmployee || selectedPlanTasks.size === 0 || isPushing) return;
    setIsPushing(true);
    setPushResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('add-planning-to-calendar', {
        body: { werknemerId: selectedEmployee, taakIds: Array.from(selectedPlanTasks) },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message || 'Onbekende fout');
      setPushResult({ succeeded: data.succeeded ?? 0, failed: data.failed ?? 0 });
      setIsSelectingPlanning(false);
      setSelectedPlanTasks(new Set());
      // Refresh calendar to show the new events
      setTimeout(fetchCalendarEvents, 800);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Onbekende fout';
      setPushResult({ succeeded: 0, failed: selectedPlanTasks.size });
      console.error('Push naar agenda mislukt:', msg);
    } finally {
      setIsPushing(false);
    }
  };

  return (
    <>
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
                    <Button
                      size="sm"
                      className="h-8 text-xs"
                      disabled={selectedPlanTasks.size === 0 || isPushing}
                      onClick={handlePushToCalendar}
                    >
                      {isPushing
                        ? <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" />Toevoegen…</>
                        : `Toevoegen aan agenda (${selectedPlanTasks.size})`
                      }
                    </Button>
                  </>
                )}
                {pushResult && !isSelectingPlanning && (
                  <span className={cn(
                    'text-xs font-medium',
                    pushResult.failed === 0 ? 'text-green-600' : 'text-amber-600'
                  )}>
                    {pushResult.succeeded > 0 && `✓ ${pushResult.succeeded} toegevoegd`}
                    {pushResult.failed > 0 && ` · ${pushResult.failed} mislukt`}
                  </span>
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
              onEventDetail={handleEventDetail}
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

    {/* ── Event detail panel ── */}
    {detailEventId && (
      <>
        <div
          className="fixed inset-0 z-40 bg-black/20"
          onClick={() => { setDetailEventId(null); setDetailData(null); }}
        />
        <EventDetailPanel
          detail={detailData}
          loading={detailLoading}
          werknemerId={selectedEmployee}
          onClose={() => { setDetailEventId(null); setDetailData(null); }}
          onSaved={() => { fetchCalendarEvents(); setDetailEventId(null); setDetailData(null); }}
        />
      </>
    )}
    </>
  );
}
