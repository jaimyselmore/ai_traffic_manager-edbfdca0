import { useState, useEffect, useMemo } from 'react';
import { Trash2, Download, Save, Plus } from 'lucide-react';
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
}

const DAG_NAMEN = ['Ma', 'Di', 'Wo', 'Do', 'Vr'];
const DAG_NAMEN_LANG = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag'];
const UREN = [9, 10, 11, 12, 14, 15, 16, 17];

const STATUS_LABELS: Record<string, string> = {
  concept: 'Concept',
  vast: 'Vast',
  wacht_klant: 'Wacht op klant',
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
}: TaskEditDialogProps) {
  const [projectTasks, setProjectTasks] = useState<Task[]>([]);
  const [editableRows, setEditableRows] = useState<EditableRow[]>([]);
  const [showDeleteProjectConfirm, setShowDeleteProjectConfirm] = useState(false);
  const [showDeleteTaskConfirm, setShowDeleteTaskConfirm] = useState<string | null>(null);
  const [isLoadingAll, setIsLoadingAll] = useState(false);

  // When a task is clicked, load ALL tasks for that project (across all weeks)
  useEffect(() => {
    if (!task) {
      setProjectTasks([]);
      setEditableRows([]);
      return;
    }

    async function loadProjectTasks() {
      setIsLoadingAll(true);
      try {
        // First: get tasks from current week view that match this project
        const fromCurrentWeek = allWeekTasks.filter(
          (t) => t.project_id === task!.project_id && t.project_nummer === task!.project_nummer
        );

        // Then: load ALL tasks for this project across all weeks
        if (task!.project_id) {
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
            setProjectTasks(fromCurrentWeek);
          }
        } else {
          // No project_id, match by project_nummer
          const fromCurrentWeek2 = allWeekTasks.filter(
            (t) => t.project_nummer === task!.project_nummer
          );
          setProjectTasks(fromCurrentWeek2);
        }
      } catch {
        // Fallback to current week tasks
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
    // Mark all as saved
    setEditableRows((prev) => prev.map((r) => ({ ...r, changed: false })));
  };

  const hasChanges = editableRows.some((r) => r.changed);

  // Format week label
  const formatWeekLabel = (weekStart: string) => {
    const d = new Date(weekStart + 'T00:00:00');
    const day = d.getDate();
    const month = d.getMonth() + 1;
    return `${day}/${month}`;
  };

  // Export to CSV
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

  // Group tasks by week for display
  const tasksByWeek = useMemo(() => {
    const grouped: Record<string, EditableRow[]> = {};
    editableRows.forEach((r) => {
      if (!grouped[r.week_start]) grouped[r.week_start] = [];
      grouped[r.week_start].push(r);
    });
    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  }, [editableRows]);

  const totalUren = editableRows.reduce((sum, r) => sum + r.duur_uren, 0);

  if (!task) return null;

  return (
    <>
      <Dialog open={!!task} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between pr-8">
              <div className="space-y-1">
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
              </div>
            </DialogTitle>
          </DialogHeader>

          {/* Summary bar */}
          <div className="flex items-center justify-between px-1 py-2 border-b border-border">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span><strong className="text-foreground">{editableRows.length}</strong> taken</span>
              <span><strong className="text-foreground">{totalUren}</strong> uur totaal</span>
              <span><strong className="text-foreground">{new Set(editableRows.map((r) => r.werknemer_naam)).size}</strong> medewerkers</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExportCSV}>
                <Download className="h-3.5 w-3.5 mr-1" />
                CSV
              </Button>
            </div>
          </div>

          {/* Editable table */}
          <div className="flex-1 overflow-y-auto">
            {isLoadingAll ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                Laden...
              </div>
            ) : (
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
                        <TableHead className="w-[80px]">Duur</TableHead>
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
                              <Select
                                value={row.start_uur.toString()}
                                onValueChange={(v) => updateRow(row.id, 'start_uur', parseInt(v))}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue>{row.start_uur.toString().padStart(2, '0')}:00</SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  {UREN.map((uur) => (
                                    <SelectItem key={uur} value={uur.toString()}>
                                      {uur.toString().padStart(2, '0')}:00
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="p-1.5">
                              <Select
                                value={row.duur_uren.toString()}
                                onValueChange={(v) => updateRow(row.id, 'duur_uren', parseInt(v))}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue>{row.duur_uren}u</SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  {Array.from({ length: 8 }, (_, i) => i + 1).map((d) => (
                                    <SelectItem key={d} value={d.toString()}>
                                      {d} uur
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
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
            <div>
              {task.project_id && onDeleteProject && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => setShowDeleteProjectConfirm(true)}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Hele planning verwijderen
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Sluiten
              </Button>
              {hasChanges && (
                <Button onClick={handleSaveAll}>
                  <Save className="h-4 w-4 mr-1" />
                  Wijzigingen opslaan ({editableRows.filter((r) => r.changed).length})
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete single task confirmation */}
      <AlertDialog open={!!showDeleteTaskConfirm} onOpenChange={(open) => !open && setShowDeleteTaskConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Taak verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je deze taak wilt verwijderen? Dit kan niet ongedaan worden gemaakt.
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

      {/* Delete project planning confirmation */}
      <AlertDialog open={showDeleteProjectConfirm} onOpenChange={setShowDeleteProjectConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hele projectplanning verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je <strong>alle {editableRows.length} taken</strong> van dit project wilt verwijderen uit de planner? Dit kan niet ongedaan worden gemaakt.
              <br />
              <br />
              Project: <strong>{task?.project_nummer}</strong> — {task?.klant_naam}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (task?.project_id && onDeleteProject) {
                  onDeleteProject(task.project_id);
                }
                onClose();
              }}
            >
              Ja, hele planning verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
