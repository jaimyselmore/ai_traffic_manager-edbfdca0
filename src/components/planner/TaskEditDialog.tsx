import { useState, useEffect, useMemo } from 'react';
import { Trash2, Download, Save, Plus, CheckCircle2, X, MapPin, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { Task } from '@/hooks/use-tasks';
import type { Employee } from '@/lib/data/types';
import { secureSelect } from '@/lib/data/secureDataClient';

interface TaskEditDialogProps {
  task: Task | null;
  allWeekTasks: Task[];
  employees: Employee[];
  onClose: () => void;
  onUpdate: (id: string, updates: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  onDeleteProject?: (projectId: string) => void;
  onCompleteProject?: (projectId: string) => void;
  onDeleteVerlof?: (werknemer_naam: string, werktype: string) => void;
  onAddToMeeting?: (task: Task, employee: Employee) => void;
}

const DAG_NAMEN = ['Ma', 'Di', 'Wo', 'Do', 'Vr'];
const DAG_NAMEN_LANG = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag'];

// Decimal hour helpers: 9.5 → "09:30", "09:30" → 9.5
function decimalToTimeStr(h: number): string {
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}
function timeStrToDecimal(s: string): number {
  const [h, m] = s.split(':').map(Number);
  return h + (m || 0) / 60;
}

const STATUS_LABELS: Record<string, string> = {
  concept: 'Concept',
  vast: 'Vast',
  wacht_klant: 'Wacht op klant',
  goedgekeurd: 'Goedgekeurd',
};

interface EditableRow {
  id: string;
  werknemer_naam: string;
  dag_van_week: number;
  start_uur: number;
  duur_uren: number;
  week_start: string;
  fase_naam: string;
  plan_status: string;
  changed: boolean;
}

export function TaskEditDialog({
  task,
  allWeekTasks,
  employees,
  onClose,
  onUpdate,
  onDelete,
  onDeleteProject,
  onCompleteProject,
  onDeleteVerlof,
  onAddToMeeting,
}: TaskEditDialogProps) {
  const [projectTasks, setProjectTasks] = useState<Task[]>([]);
  const [editableRows, setEditableRows] = useState<EditableRow[]>([]);
  const [showDeleteProjectConfirm, setShowDeleteProjectConfirm] = useState(false);
  const [showCompleteProjectConfirm, setShowCompleteProjectConfirm] = useState(false);
  const [showDeleteTaskConfirm, setShowDeleteTaskConfirm] = useState<string | null>(null);
  const [showDeleteVerlofConfirm1, setShowDeleteVerlofConfirm1] = useState(false);
  const [showDeleteVerlofConfirm2, setShowDeleteVerlofConfirm2] = useState(false);
  const [isLoadingAll, setIsLoadingAll] = useState(false);
  const [addParticipantId, setAddParticipantId] = useState<string>('');
  const [meetingStartTime, setMeetingStartTime] = useState('');
  const [meetingEndTime, setMeetingEndTime] = useState('');
  const [meetingDag, setMeetingDag] = useState(0);
  const [meetingTimeChanged, setMeetingTimeChanged] = useState(false);
  const [meetingDetails, setMeetingDetails] = useState<{ onderwerp: string; locatie: string | null; type: string } | null>(null);

  const isVerlofOfZiek = task?.werktype === 'verlof' || task?.werktype === 'ziek';
  const isMeeting = task?.werktype === 'extern';

  // Initialize meeting time/day when task changes
  useEffect(() => {
    if (!task || task.werktype !== 'extern') return;
    setMeetingStartTime(task.startTime || decimalToTimeStr(task.start_uur ?? 9));
    setMeetingEndTime(task.endTime || decimalToTimeStr((task.start_uur ?? 9) + (task.duur_uren ?? 1)));
    setMeetingDag(task.dag_van_week ?? 0);
    setMeetingTimeChanged(false);
  }, [task?.id]);

  const handleSaveMeetingTime = () => {
    const startDecimal = timeStrToDecimal(meetingStartTime);
    const endDecimal = timeStrToDecimal(meetingEndTime);
    const dur = Math.round((endDecimal - startDecimal) * 4) / 4; // round to quarter-hour
    if (dur <= 0) return;
    editableRows.forEach((row) => {
      onUpdate(row.id, { start_uur: startDecimal, duur_uren: dur, dag_van_week: meetingDag });
    });
    setMeetingTimeChanged(false);
  };

  // Employees not yet in this meeting
  const currentParticipantNames = new Set(editableRows.map((r) => r.werknemer_naam));
  const availableToAdd = employees.filter((e) => !currentParticipantNames.has(e.name));

  // When a task is clicked, load ALL tasks for that project (across all weeks)
  useEffect(() => {
    if (!task) {
      setProjectTasks([]);
      setEditableRows([]);
      setMeetingDetails(null);
      return;
    }

    async function loadProjectTasks() {
      setIsLoadingAll(true);
      try {
        if (isVerlofOfZiek) {
          // For verlof/ziek: load ALL tasks for this employee + werktype across all weeks
          const { data, error } = await secureSelect<any>('taken', {
            filters: [
              { column: 'werknemer_naam', operator: 'eq', value: task!.werknemer_naam },
              { column: 'werktype', operator: 'eq', value: task!.werktype },
            ],
            order: { column: 'week_start', ascending: true },
          });

          if (!error && data) {
            const mapped: Task[] = (data as any[]).map((row) => {
              const taskDate = new Date(row.week_start + 'T00:00:00');
              taskDate.setDate(taskDate.getDate() + row.dag_van_week);
              const dateStr = `${taskDate.getFullYear()}-${String(taskDate.getMonth() + 1).padStart(2, '0')}-${String(taskDate.getDate()).padStart(2, '0')}`;
              return {
                id: row.id,
                project_id: row.project_id,
                werknemer_naam: row.werknemer_naam,
                klant_naam: row.klant_naam,
                project_nummer: row.project_nummer,
                fase_naam: row.fase_naam,
                werktype: row.werktype,
                discipline: row.discipline,
                week_start: row.week_start,
                dag_van_week: row.dag_van_week,
                start_uur: row.start_uur,
                duur_uren: row.duur_uren,
                plan_status: row.plan_status || 'goedgekeurd',
                is_hard_lock: row.is_hard_lock || false,
                employeeId: row.werknemer_naam,
                clientName: row.klant_naam,
                clientId: row.klant_naam,
                date: dateStr,
                startTime: `${row.start_uur.toString().padStart(2, '0')}:00`,
                endTime: `${(row.start_uur + row.duur_uren).toString().padStart(2, '0')}:00`,
                type: row.werktype,
                planStatus: row.plan_status || 'goedgekeurd',
                projectTitel: row.project_titel,
                faseNaam: row.fase_naam,
              } as Task;
            });
            setProjectTasks(mapped);
          } else {
            // Fallback to current week
            setProjectTasks(
              allWeekTasks.filter(
                (t) => t.werknemer_naam === task!.werknemer_naam && t.werktype === task!.werktype
              )
            );
          }
        } else if (task!.project_id) {
          // Regular project: load all tasks by project_id
          const { data, error } = await secureSelect<any>('taken', {
            filters: [{ column: 'project_id', operator: 'eq', value: task!.project_id }],
            order: { column: 'week_start', ascending: true },
          });

          if (!error && data) {
            const mapped: Task[] = (data as any[]).map((row) => {
              const taskDate = new Date(row.week_start + 'T00:00:00');
              taskDate.setDate(taskDate.getDate() + row.dag_van_week);
              const dateStr = `${taskDate.getFullYear()}-${String(taskDate.getMonth() + 1).padStart(2, '0')}-${String(taskDate.getDate()).padStart(2, '0')}`;
              return {
                id: row.id,
                project_id: row.project_id,
                werknemer_naam: row.werknemer_naam,
                klant_naam: row.klant_naam,
                project_nummer: row.project_nummer,
                fase_naam: row.fase_naam,
                werktype: row.werktype,
                discipline: row.discipline,
                week_start: row.week_start,
                dag_van_week: row.dag_van_week,
                start_uur: row.start_uur,
                duur_uren: row.duur_uren,
                plan_status: row.plan_status || 'concept',
                is_hard_lock: row.is_hard_lock || false,
                employeeId: row.werknemer_naam,
                clientName: row.klant_naam,
                clientId: row.klant_naam,
                date: dateStr,
                startTime: `${row.start_uur.toString().padStart(2, '0')}:00`,
                endTime: `${(row.start_uur + row.duur_uren).toString().padStart(2, '0')}:00`,
                type: row.werktype || 'concept',
                planStatus: row.plan_status || 'concept',
                projectTitel: row.project_titel,
                faseNaam: row.fase_naam,
              } as Task;
            });
            setProjectTasks(mapped);
          } else {
            setProjectTasks(allWeekTasks.filter((t) => t.project_id === task!.project_id));
          }
        } else if (task!.werktype === 'extern') {
          // Meeting without project_id: find all participants by same time slot
          setProjectTasks(
            allWeekTasks.filter(
              (t) =>
                t.project_nummer === task!.project_nummer &&
                t.werktype === 'extern' &&
                t.week_start === task!.week_start &&
                t.dag_van_week === task!.dag_van_week &&
                t.start_uur === task!.start_uur
            )
          );
        } else {
          // No project_id: match by project_nummer and werknemer_naam
          setProjectTasks(
            allWeekTasks.filter(
              (t) => t.project_nummer === task!.project_nummer && t.werknemer_naam === task!.werknemer_naam
            )
          );
        }
        // Fetch meeting details from meetings & presentaties table
        if (task!.werktype === 'extern') {
          const filters: { column: string; operator: string; value: unknown }[] = [];
          if (task!.project_id) {
            filters.push({ column: 'project_id', operator: 'eq', value: task!.project_id });
          } else {
            // Match by date and start time
            const d = new Date(task!.week_start + 'T00:00:00');
            d.setDate(d.getDate() + task!.dag_van_week);
            const datum = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const startH = Math.floor(task!.start_uur);
            const startM = Math.round((task!.start_uur - startH) * 60);
            const startTijd = `${startH.toString().padStart(2, '0')}:${startM.toString().padStart(2, '0')}`;
            filters.push({ column: 'datum', operator: 'eq', value: datum });
            filters.push({ column: 'start_tijd', operator: 'eq', value: startTijd });
          }
          const { data: mdData } = await secureSelect<any>('meetings & presentaties', { filters, limit: 1 });
          if (mdData && mdData.length > 0) {
            setMeetingDetails({ onderwerp: mdData[0].onderwerp, locatie: mdData[0].locatie, type: mdData[0].type });
          } else {
            setMeetingDetails(null);
          }
        }
      } catch {
        setProjectTasks(
          allWeekTasks.filter((t) => t.project_nummer === task!.project_nummer)
        );
      } finally {
        setIsLoadingAll(false);
      }
    }

    loadProjectTasks();
  }, [task?.id]);

  // Initialize editable rows when projectTasks changes
  useEffect(() => {
    setEditableRows(
      projectTasks.map((t) => ({
        id: t.id,
        werknemer_naam: t.werknemer_naam,
        dag_van_week: t.dag_van_week,
        start_uur: t.start_uur,
        duur_uren: t.duur_uren,
        week_start: t.week_start,
        fase_naam: t.fase_naam,
        plan_status: t.plan_status,
        changed: false,
      }))
    );
  }, [projectTasks]);

  const updateRow = (id: string, field: string, value: unknown) => {
    setEditableRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value, changed: true } : r))
    );
  };

  const handleSaveAll = () => {
    const changedRows = editableRows.filter((r) => r.changed);
    changedRows.forEach((row) => {
      const original = projectTasks.find((t) => t.id === row.id);
      if (!original) return;
      const updates: Record<string, unknown> = {};
      if (row.werknemer_naam !== original.werknemer_naam) updates.werknemer_naam = row.werknemer_naam;
      if (row.dag_van_week !== original.dag_van_week) updates.dag_van_week = row.dag_van_week;
      if (row.start_uur !== original.start_uur) updates.start_uur = row.start_uur;
      if (row.duur_uren !== original.duur_uren) updates.duur_uren = row.duur_uren;
      if (Object.keys(updates).length > 0) {
        onUpdate(row.id, updates);
      }
    });
    setEditableRows((prev) => prev.map((r) => ({ ...r, changed: false })));
  };

  const hasChanges = editableRows.some((r) => r.changed);

  const formatWeekLabel = (weekStart: string) => {
    const d = new Date(weekStart + 'T00:00:00');
    const day = d.getDate();
    const month = d.getMonth() + 1;
    return `${day}/${month}`;
  };

  const formatDate = (weekStart: string, dagVanWeek: number) => {
    const d = new Date(weekStart + 'T00:00:00');
    d.setDate(d.getDate() + dagVanWeek);
    return `${DAG_NAMEN_LANG[dagVanWeek] || ''} ${d.getDate()}/${d.getMonth() + 1}`;
  };

  const handleExportCSV = () => {
    if (projectTasks.length === 0) return;
    const headers = ['Medewerker', 'Week start', 'Dag', 'Starttijd', 'Eindtijd', 'Duur (uren)', 'Fase', 'Status'];
    const rows = editableRows.map((r) => [
      r.werknemer_naam,
      r.week_start,
      DAG_NAMEN_LANG[r.dag_van_week] || r.dag_van_week,
      `${r.start_uur.toString().padStart(2, '0')}:00`,
      `${(r.start_uur + r.duur_uren).toString().padStart(2, '0')}:00`,
      r.duur_uren,
      r.fase_naam,
      STATUS_LABELS[r.plan_status] || r.plan_status,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `planning-${task?.project_nummer || 'project'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tasksByWeek = useMemo(() => {
    const grouped: Record<string, EditableRow[]> = {};
    editableRows.forEach((r) => {
      if (!grouped[r.week_start]) grouped[r.week_start] = [];
      grouped[r.week_start].push(r);
    });
    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  }, [editableRows]);

  const totalUren = editableRows.reduce((sum, r) => sum + r.duur_uren, 0);

  const verlofLabel = task?.werktype === 'ziek' ? 'Ziekmelding' : 'Verlof';

  if (!task) return null;

  return (
    <>
      <Dialog open={!!task} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between pr-8">
              <div className="space-y-1">
                {isVerlofOfZiek ? (
                  <>
                    <span className="text-lg">{verlofLabel} — {task.werknemer_naam}</span>
                    <div className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
                      <span>{editableRows.length} dag{editableRows.length !== 1 ? 'en' : ''}</span>
                      {editableRows.length > 0 && (
                        <>
                          <span>•</span>
                          <span>
                            {formatDate(editableRows[0].week_start, editableRows[0].dag_van_week)}
                            {editableRows.length > 1 && ` t/m ${formatDate(editableRows[editableRows.length - 1].week_start, editableRows[editableRows.length - 1].dag_van_week)}`}
                          </span>
                        </>
                      )}
                    </div>
                  </>
                ) : isMeeting ? (
                  <>
                    <span className="text-lg">{task.projectTitel || task.faseNaam || 'Meeting'}</span>
                    <div className="text-sm font-normal text-muted-foreground space-y-0.5">
                      {task.projectTitel && task.faseNaam && task.faseNaam !== task.projectTitel && (
                        <div>{task.faseNaam}</div>
                      )}
                      <div className="flex items-center gap-2 flex-wrap">
                        {task.startTime && <span>{task.startTime} – {task.endTime}</span>}
                        {task.klant_naam && task.klant_naam !== task.faseNaam && task.klant_naam !== task.projectTitel && (
                          <><span>•</span><span>{task.klant_naam}</span></>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="text-lg">Projectplanning — {task.klant_naam}</span>
                    <div className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
                      <span>{task.project_nummer}</span>
                      <span>•</span>
                      <span>{task.faseNaam || task.fase_naam}</span>
                      <span>•</span>
                      <Badge variant="outline" className="text-xs">
                        {STATUS_LABELS[task.planStatus] || task.planStatus}
                      </Badge>
                    </div>
                  </>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>

          {/* Summary bar */}
          <div className="px-1 py-2 border-b border-border space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>
                  <strong className="text-foreground">{editableRows.length}</strong>{' '}
                  {isVerlofOfZiek ? 'dagen' : isMeeting ? 'deelnemer(s)' : 'taken'}
                </span>
                {!isVerlofOfZiek && !isMeeting && <span><strong className="text-foreground">{totalUren}</strong> uur totaal</span>}
                {!isVerlofOfZiek && !isMeeting && (
                  <span><strong className="text-foreground">{new Set(editableRows.map((r) => r.werknemer_naam)).size}</strong> medewerkers</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!isVerlofOfZiek && !isMeeting && (
                  <Button variant="outline" size="sm" onClick={handleExportCSV}>
                    <Download className="h-3.5 w-3.5 mr-1" />
                    CSV
                  </Button>
                )}
              </div>
            </div>
            {/* Employee chips for regular projects */}
            {!isVerlofOfZiek && !isMeeting && editableRows.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {Array.from(new Set(editableRows.map((r) => r.werknemer_naam))).map((name) => (
                  <Badge key={name} variant="secondary" className="text-xs font-normal">
                    {name}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Main content */}
          <div className="flex-1 overflow-y-auto">
            {isLoadingAll ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                Laden...
              </div>
            ) : isMeeting ? (
              // Meeting: time editing + participants as chips
              <div className="py-4 px-1 space-y-5">
                {/* Meeting details (onderwerp + locatie) */}
                {meetingDetails && (meetingDetails.onderwerp || meetingDetails.locatie) && (
                  <div className="space-y-1.5">
                    {meetingDetails.onderwerp && (
                      <div className="flex items-start gap-2 text-sm">
                        <MessageSquare className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                        <span>{meetingDetails.onderwerp}</span>
                      </div>
                    )}
                    {meetingDetails.locatie && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span>{meetingDetails.locatie}</span>
                      </div>
                    )}
                  </div>
                )}
                {/* Time & day controls */}
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tijden</div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Select
                      value={meetingDag.toString()}
                      onValueChange={(v) => { setMeetingDag(parseInt(v)); setMeetingTimeChanged(true); }}
                    >
                      <SelectTrigger className="h-8 w-[120px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DAG_NAMEN_LANG.map((dag, i) => (
                          <SelectItem key={i} value={i.toString()}>{dag}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <input
                      type="time"
                      step="900"
                      value={meetingStartTime}
                      onChange={(e) => { setMeetingStartTime(e.target.value); setMeetingTimeChanged(true); }}
                      className="h-8 px-2 text-xs border border-input rounded-md bg-background text-foreground"
                    />
                    <span className="text-muted-foreground text-xs">–</span>
                    <input
                      type="time"
                      step="900"
                      value={meetingEndTime}
                      onChange={(e) => { setMeetingEndTime(e.target.value); setMeetingTimeChanged(true); }}
                      className="h-8 px-2 text-xs border border-input rounded-md bg-background text-foreground"
                    />
                    {meetingTimeChanged && (
                      <Button size="sm" onClick={handleSaveMeetingTime}>
                        <Save className="h-3.5 w-3.5 mr-1" />
                        Opslaan
                      </Button>
                    )}
                  </div>
                </div>
                {/* Participants */}
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Deelnemers</div>
                  <div className="flex flex-wrap gap-2">
                    {editableRows.map((row) => (
                      <div
                        key={row.id}
                        className="flex items-center gap-1.5 bg-secondary rounded-full pl-1.5 pr-2 py-1"
                      >
                        <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-xs text-primary-foreground shrink-0 font-medium">
                          {row.werknemer_naam.split(' ').map((n: string) => n[0]).join('').substring(0, 2)}
                        </div>
                        <span className="text-sm font-medium">{row.werknemer_naam}</span>
                        <button
                          className="ml-0.5 h-5 w-5 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-background transition-colors"
                          onClick={() => setShowDeleteTaskConfirm(row.id)}
                          title={`${row.werknemer_naam} verwijderen uit meeting`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  {onAddToMeeting && availableToAdd.length > 0 && (
                    <div className="flex items-center gap-1 pt-1">
                      <Select value={addParticipantId} onValueChange={setAddParticipantId}>
                        <SelectTrigger className="h-8 w-44 text-xs">
                          <SelectValue placeholder="Deelnemer toevoegen…" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableToAdd.map((emp) => (
                            <SelectItem key={emp.id} value={emp.id}>
                              {emp.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!addParticipantId}
                        onClick={() => {
                          const emp = employees.find((e) => e.id === addParticipantId);
                          if (emp && task) {
                            onAddToMeeting(task, emp);
                            const base = editableRows[0];
                            if (base) {
                              setEditableRows((prev) => [
                                ...prev,
                                {
                                  id: `pending-${emp.id}-${Date.now()}`,
                                  werknemer_naam: emp.name,
                                  dag_van_week: base.dag_van_week,
                                  start_uur: base.start_uur,
                                  duur_uren: base.duur_uren,
                                  week_start: base.week_start,
                                  fase_naam: base.fase_naam,
                                  plan_status: base.plan_status,
                                  changed: false,
                                },
                              ]);
                            }
                            setAddParticipantId('');
                          }
                        }}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ) : isVerlofOfZiek ? (
              // Verlof/ziek: simple list per day
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead>Starttijd</TableHead>
                    <TableHead>Eindtijd</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {editableRows
                    .sort((a, b) => a.week_start.localeCompare(b.week_start) || a.dag_van_week - b.dag_van_week)
                    .map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">
                          {formatDate(row.week_start, row.dag_van_week)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {row.start_uur.toString().padStart(2, '0')}:00
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {(row.start_uur + row.duur_uren).toString().padStart(2, '0')}:00
                        </TableCell>
                        <TableCell className="p-1.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => setShowDeleteTaskConfirm(row.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            ) : (
              // Regular project: editable rows grouped by week
              tasksByWeek.map(([weekStart, rows]) => (
                <div key={weekStart} className="mb-4">
                  <div className="text-xs font-medium text-muted-foreground px-1 py-1.5 bg-muted/30 rounded-t-md">
                    Week van {formatWeekLabel(weekStart)}
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[180px]">Medewerker</TableHead>
                        <TableHead className="w-[100px]">Dag</TableHead>
                        <TableHead className="w-[100px]">Start</TableHead>
                        <TableHead className="w-[100px]">Eind</TableHead>
                        <TableHead className="w-[140px]">Fase</TableHead>
                        <TableHead className="w-[60px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows
                        .sort((a, b) => a.dag_van_week - b.dag_van_week || a.start_uur - b.start_uur)
                        .map((row) => (
                          <TableRow
                            key={row.id}
                            className={cn(row.changed && 'bg-accent/50')}
                          >
                            <TableCell className="p-1.5">
                              <Select
                                value={row.werknemer_naam}
                                onValueChange={(v) => updateRow(row.id, 'werknemer_naam', v)}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {employees.map((emp) => (
                                    <SelectItem key={emp.id} value={emp.name}>
                                      {emp.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="p-1.5">
                              <Select
                                value={row.dag_van_week.toString()}
                                onValueChange={(v) => updateRow(row.id, 'dag_van_week', parseInt(v))}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {DAG_NAMEN_LANG.map((dag, i) => (
                                    <SelectItem key={i} value={i.toString()}>
                                      {dag}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="p-1.5">
                              <input
                                type="time"
                                step="900"
                                value={decimalToTimeStr(row.start_uur)}
                                onChange={(e) => updateRow(row.id, 'start_uur', timeStrToDecimal(e.target.value))}
                                className="h-8 w-[90px] px-2 text-xs border border-input rounded-md bg-background text-foreground"
                              />
                            </TableCell>
                            <TableCell className="p-1.5">
                              <input
                                type="time"
                                step="900"
                                value={decimalToTimeStr(row.start_uur + row.duur_uren)}
                                onChange={(e) => {
                                  const newEnd = timeStrToDecimal(e.target.value);
                                  const dur = Math.round((newEnd - row.start_uur) * 4) / 4;
                                  if (dur > 0) updateRow(row.id, 'duur_uren', dur);
                                }}
                                className="h-8 w-[90px] px-2 text-xs border border-input rounded-md bg-background text-foreground"
                              />
                            </TableCell>
                            <TableCell className="p-1.5">
                              <span className="text-xs text-muted-foreground">{row.fase_naam}</span>
                            </TableCell>
                            <TableCell className="p-1.5">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => setShowDeleteTaskConfirm(row.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              ))
            )}
          </div>

          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between border-t border-border pt-4">
            <div className="flex flex-wrap gap-2">
              {isVerlofOfZiek && onDeleteVerlof && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => setShowDeleteVerlofConfirm1(true)}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Gehele {verlofLabel.toLowerCase()}periode verwijderen
                </Button>
              )}
              {!isVerlofOfZiek && !isMeeting && task.project_id && onCompleteProject && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-green-600 border-green-600/30 hover:bg-green-50"
                  onClick={() => setShowCompleteProjectConfirm(true)}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Project afronden
                </Button>
              )}
              {!isVerlofOfZiek && (isMeeting || task.project_id) && (isMeeting ? true : !!onDeleteProject) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => setShowDeleteProjectConfirm(true)}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  {isMeeting ? 'Hele meeting verwijderen' : 'Hele planning verwijderen'}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Sluiten
              </Button>
              {hasChanges && !isVerlofOfZiek && !isMeeting && (
                <Button onClick={handleSaveAll}>
                  <Save className="h-4 w-4 mr-1" />
                  Wijzigingen opslaan ({editableRows.filter((r) => r.changed).length})
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete single day confirmation */}
      <AlertDialog open={!!showDeleteTaskConfirm} onOpenChange={(open) => !open && setShowDeleteTaskConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isVerlofOfZiek ? 'Dag verwijderen?' : 'Taak verwijderen?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {isVerlofOfZiek
                ? 'Weet je zeker dat je deze dag wilt verwijderen uit de verlofperiode?'
                : 'Weet je zeker dat je deze taak wilt verwijderen? Dit kan niet ongedaan worden gemaakt.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (showDeleteTaskConfirm) {
                  onDelete(showDeleteTaskConfirm);
                  setEditableRows((prev) => prev.filter((r) => r.id !== showDeleteTaskConfirm));
                  setProjectTasks((prev) => prev.filter((t) => t.id !== showDeleteTaskConfirm));
                }
                setShowDeleteTaskConfirm(null);
              }}
            >
              Ja, verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete verlof – eerste bevestiging */}
      <AlertDialog open={showDeleteVerlofConfirm1} onOpenChange={setShowDeleteVerlofConfirm1}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gehele {verlofLabel.toLowerCase()}periode verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Je staat op het punt om <strong>alle {editableRows.length} dag{editableRows.length !== 1 ? 'en' : ''}</strong> van de {verlofLabel.toLowerCase()}periode van{' '}
              <strong>{task?.werknemer_naam}</strong> te verwijderen uit de planner.
              <br /><br />
              Dit verwijdert ook de registratie uit de beschikbaarheidsadministratie.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setShowDeleteVerlofConfirm1(false);
                setShowDeleteVerlofConfirm2(true);
              }}
            >
              Ja, ik wil dit verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete verlof – tweede bevestiging */}
      <AlertDialog open={showDeleteVerlofConfirm2} onOpenChange={setShowDeleteVerlofConfirm2}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Definitief verwijderen — weet je het zeker?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>Let op:</strong> dit verwijdert de volledige {verlofLabel.toLowerCase()}periode van{' '}
              <strong>{task?.werknemer_naam}</strong> ({editableRows.length} dag{editableRows.length !== 1 ? 'en' : ''}).
              Dit kan <strong>niet ongedaan</strong> worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (task && onDeleteVerlof) {
                  onDeleteVerlof(task.werknemer_naam, task.werktype);
                }
                setShowDeleteVerlofConfirm2(false);
                onClose();
              }}
            >
              Ja, definitief verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete project planning / meeting confirmation */}
      <AlertDialog open={showDeleteProjectConfirm} onOpenChange={setShowDeleteProjectConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isMeeting ? 'Hele meeting verwijderen?' : 'Hele projectplanning verwijderen?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {isMeeting ? (
                <>
                  Weet je zeker dat je <strong>alle {editableRows.length} deelnemer(s)</strong> van deze meeting wilt verwijderen? Dit verwijdert de volledige meeting uit de planner en kan niet ongedaan worden gemaakt.
                  <br /><br />
                  Meeting: <strong>{task?.projectTitel || task?.faseNaam || 'Meeting'}</strong>
                </>
              ) : (
                <>
                  Weet je zeker dat je <strong>alle {editableRows.length} taken</strong> van dit project wilt verwijderen uit de planner? Dit kan niet ongedaan worden gemaakt.
                  <br /><br />
                  Project: <strong>{task?.project_nummer}</strong> — {task?.klant_naam}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (task?.project_id && onDeleteProject) {
                  onDeleteProject(task.project_id);
                } else if (isMeeting) {
                  // Meeting without project_id: delete each participant individually
                  editableRows.forEach((row) => onDelete(row.id));
                }
                onClose();
              }}
            >
              {isMeeting ? 'Ja, meeting verwijderen' : 'Ja, hele planning verwijderen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Complete project confirmation */}
      <AlertDialog open={showCompleteProjectConfirm} onOpenChange={setShowCompleteProjectConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Project afronden?</AlertDialogTitle>
            <AlertDialogDescription>
              Het project wordt gemarkeerd als afgerond. De taken blijven bewaard in het systeem maar het project verschijnt niet meer bij de actieve projecten.
              <br />
              <br />
              Project: <strong>{task?.project_nummer}</strong> — {task?.klant_naam}
              <br />
              <span className="text-muted-foreground">({editableRows.length} taken, {totalUren} uur totaal)</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              className="bg-green-600 text-white hover:bg-green-700"
              onClick={() => {
                if (task?.project_id && onCompleteProject) {
                  onCompleteProject(task.project_id);
                }
                onClose();
              }}
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Ja, project afronden
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
