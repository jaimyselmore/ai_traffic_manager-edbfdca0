import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { Label } from '@/components/ui/label';
import type { Task } from '@/hooks/use-tasks';
import type { Employee } from '@/lib/data/types';

interface TaskEditDialogProps {
  task: Task | null;
  employees: Employee[];
  onClose: () => void;
  onUpdate: (id: string, updates: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  onDeleteProject?: (projectId: string) => void;
}

const DAG_NAMEN = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag'];
const UREN = [9, 10, 11, 12, 14, 15, 16, 17]; // Skip 13 (lunch)

export function TaskEditDialog({ task, employees, onClose, onUpdate, onDelete, onDeleteProject }: TaskEditDialogProps) {
  const [dagVanWeek, setDagVanWeek] = useState(task?.dag_van_week ?? 0);
  const [startUur, setStartUur] = useState(task?.start_uur ?? 9);
  const [duurUren, setDuurUren] = useState(task?.duur_uren ?? 1);
  const [werknemerNaam, setWerknemerNaam] = useState(task?.werknemer_naam ?? '');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeleteProjectConfirm, setShowDeleteProjectConfirm] = useState(false);

  if (!task) return null;

  const handleSave = () => {
    const updates: Record<string, unknown> = {};
    if (dagVanWeek !== task.dag_van_week) updates.dag_van_week = dagVanWeek;
    if (startUur !== task.start_uur) updates.start_uur = startUur;
    if (duurUren !== task.duur_uren) updates.duur_uren = duurUren;
    if (werknemerNaam !== task.werknemer_naam) updates.werknemer_naam = werknemerNaam;

    if (Object.keys(updates).length > 0) {
      onUpdate(task.id, updates);
    }
    onClose();
  };

  const maxDuur = (() => {
    let max = 18 - startUur;
    // If starting before lunch, count lunch hour out
    if (startUur < 13 && startUur + max > 13) max -= 1;
    return Math.max(1, max);
  })();

  return (
    <>
      <Dialog open={!!task} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Taak bewerken</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Info */}
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
              <p className="text-sm font-medium text-foreground">{task.klant_naam}</p>
              <p className="text-xs text-muted-foreground">
                {task.faseNaam || task.fase_naam} • {task.project_nummer}
              </p>
              <p className="text-xs text-muted-foreground">
                Status: <span className="font-medium">{task.planStatus === 'vast' ? 'Vast' : task.planStatus === 'wacht_klant' ? 'Wacht op klant' : 'Concept'}</span>
              </p>
            </div>

            {/* Medewerker */}
            <div className="space-y-1.5">
              <Label className="text-sm">Medewerker</Label>
              <Select value={werknemerNaam} onValueChange={setWerknemerNaam}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.name}>{emp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Dag */}
            <div className="space-y-1.5">
              <Label className="text-sm">Dag</Label>
              <Select value={dagVanWeek.toString()} onValueChange={(v) => setDagVanWeek(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAG_NAMEN.map((dag, i) => (
                    <SelectItem key={i} value={i.toString()}>{dag}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Starttijd */}
            <div className="space-y-1.5">
              <Label className="text-sm">Starttijd</Label>
              <Select value={startUur.toString()} onValueChange={(v) => setStartUur(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UREN.map((uur) => (
                    <SelectItem key={uur} value={uur.toString()}>{uur.toString().padStart(2, '0')}:00</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Duur */}
            <div className="space-y-1.5">
              <Label className="text-sm">Duur (uren)</Label>
              <Select value={duurUren.toString()} onValueChange={(v) => setDuurUren(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: maxDuur }, (_, i) => i + 1).map((d) => (
                    <SelectItem key={d} value={d.toString()}>{d} uur</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            <div className="flex gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Verwijder taak
              </Button>
              {task.project_id && onDeleteProject && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => setShowDeleteProjectConfirm(true)}
                >
                  Verwijder hele planning
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>Annuleren</Button>
              <Button onClick={handleSave}>Opslaan</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete task confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Taak verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je deze taak wilt verwijderen? Dit kan niet ongedaan worden gemaakt.
              <br /><br />
              <strong>{task.klant_naam}</strong> — {task.faseNaam || task.fase_naam}
              <br />
              {task.werknemer_naam} • {task.startTime} - {task.endTime}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                onDelete(task.id);
                onClose();
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
              Weet je zeker dat je <strong>alle taken</strong> van dit project wilt verwijderen uit de planner? Dit kan niet ongedaan worden gemaakt.
              <br /><br />
              Project: <strong>{task.project_nummer}</strong> — {task.klant_naam}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (task.project_id && onDeleteProject) {
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
