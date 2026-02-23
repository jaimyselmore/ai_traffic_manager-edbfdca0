import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Clock, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { secureSelect, secureUpdate, secureDelete } from '@/lib/data/secureDataClient';
import { toast } from '@/hooks/use-toast';

interface WachtKlantProject {
  project_id: string;
  project_nummer: string;
  klant_naam: string;
  fase_naam: string;
  taak_ids: string[];
  totaal_uren: number;
  medewerkers: string[];
  created_at: string;
}

export function WachtOpGoedkeuring() {
  const navigate = useNavigate();
  const [projecten, setProjecten] = useState<WachtKlantProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionTarget, setActionTarget] = useState<{ project: WachtKlantProject; action: 'approve' | 'reject' } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadWachtKlantProjecten();
  }, []);

  async function loadWachtKlantProjecten() {
    setIsLoading(true);
    try {
      const { data, error } = await secureSelect<{
        id: string;
        project_id: string;
        project_nummer: string;
        klant_naam: string;
        fase_naam: string;
        werknemer_naam: string;
        duur_uren: number;
        created_at: string;
      }>('taken', {
        filters: [{ column: 'plan_status', operator: 'eq', value: 'wacht_klant' }],
        order: { column: 'created_at', ascending: false },
      });

      if (error || !data) {
        setProjecten([]);
        return;
      }

      // Groepeer per project
      const grouped: Record<string, WachtKlantProject> = {};
      for (const taak of data) {
        const key = taak.project_nummer;
        if (!grouped[key]) {
          grouped[key] = {
            project_id: taak.project_id || '',
            project_nummer: taak.project_nummer,
            klant_naam: taak.klant_naam,
            fase_naam: taak.fase_naam,
            taak_ids: [],
            totaal_uren: 0,
            medewerkers: [],
            created_at: taak.created_at || '',
          };
        }
        grouped[key].taak_ids.push(taak.id);
        grouped[key].totaal_uren += taak.duur_uren;
        if (!grouped[key].medewerkers.includes(taak.werknemer_naam)) {
          grouped[key].medewerkers.push(taak.werknemer_naam);
        }
      }

      setProjecten(Object.values(grouped));
    } catch (err) {
      console.error('Error loading wacht_klant projecten:', err);
      setProjecten([]);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleApprove(project: WachtKlantProject) {
    setIsProcessing(true);
    try {
      // Update alle taken naar status 'concept' (goedgekeurd door klant, nog niet vast)
      for (const taakId of project.taak_ids) {
        await secureUpdate('taken', { plan_status: 'concept' }, [
          { column: 'id', operator: 'eq', value: taakId },
        ]);
      }

      toast({
        title: 'Goedgekeurd',
        description: `Planning voor ${project.klant_naam} is goedgekeurd en staat nu als concept in de planner.`,
      });

      loadWachtKlantProjecten();
    } catch (err) {
      toast({
        title: 'Fout',
        description: 'Kon de planning niet goedkeuren.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
      setActionTarget(null);
    }
  }

  async function handleReject(project: WachtKlantProject) {
    setIsProcessing(true);
    try {
      // Verwijder alle taken
      for (const taakId of project.taak_ids) {
        await secureDelete('taken', [
          { column: 'id', operator: 'eq', value: taakId },
        ]);
      }

      toast({
        title: 'Afgewezen',
        description: `Planning voor ${project.klant_naam} is verwijderd.`,
      });

      loadWachtKlantProjecten();
    } catch (err) {
      toast({
        title: 'Fout',
        description: 'Kon de planning niet verwijderen.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
      setActionTarget(null);
    }
  }

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center">
        <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2 animate-spin" />
        <p className="text-sm text-muted-foreground">Laden...</p>
      </div>
    );
  }

  if (projecten.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center">
        <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">
          Geen planningen die wachten op goedkeuring.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="space-y-3">
        {projecten.map((project) => (
          <div
            key={project.project_nummer}
            className="flex items-center justify-between p-4 border border-border rounded-xl bg-background hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex-shrink-0">
                <Clock className="h-4 w-4 text-amber-500" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {project.klant_naam} - {project.fase_naam}
                </p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <Badge variant="outline" className="text-xs">
                    {project.project_nummer}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {project.totaal_uren}u • {project.medewerkers.join(', ')}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="text-green-600 border-green-600 hover:bg-green-50"
                onClick={() => setActionTarget({ project, action: 'approve' })}
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Goedkeuren
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 border-red-600 hover:bg-red-50"
                onClick={() => setActionTarget({ project, action: 'reject' })}
              >
                <XCircle className="h-4 w-4 mr-1" />
                Afwijzen
              </Button>
            </div>
          </div>
        ))}
      </div>

      <AlertDialog open={!!actionTarget} onOpenChange={(open) => !open && setActionTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionTarget?.action === 'approve' ? 'Planning goedkeuren?' : 'Planning afwijzen?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionTarget?.action === 'approve'
                ? `De planning voor "${actionTarget.project.klant_naam}" wordt goedgekeurd en staat dan als concept in de planner.`
                : `De planning voor "${actionTarget?.project.klant_naam}" wordt verwijderd. Dit kan niet ongedaan worden gemaakt.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              disabled={isProcessing}
              className={actionTarget?.action === 'reject' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
              onClick={() => {
                if (actionTarget?.action === 'approve') {
                  handleApprove(actionTarget.project);
                } else if (actionTarget?.action === 'reject') {
                  handleReject(actionTarget.project);
                }
              }}
            >
              {isProcessing ? 'Bezig...' : (actionTarget?.action === 'approve' ? 'Goedkeuren' : 'Afwijzen')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Export de count functie voor de StatCard
export async function getWachtKlantCount(): Promise<number> {
  try {
    const { data, error } = await secureSelect<{ id: string }>('taken', {
      filters: [{ column: 'plan_status', operator: 'eq', value: 'wacht_klant' }],
    });
    if (error || !data) return 0;

    // Tel unieke projectnummers
    const projectNummers = new Set(data.map((t: any) => t.project_nummer));
    return projectNummers.size;
  } catch {
    return 0;
  }
}
