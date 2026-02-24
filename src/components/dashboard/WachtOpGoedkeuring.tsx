import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Clock, XCircle, MessageSquare, Edit3, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  taken_details?: Array<{
    werknemer_naam: string;
    dag_van_week: number;
    week_start: string;
    start_uur: number;
    duur_uren: number;
    fase_naam: string;
  }>;
}

type RejectAction = 'feedback_ellen' | 'manual_edit' | 'delete';

export function WachtOpGoedkeuring() {
  const navigate = useNavigate();
  const [projecten, setProjecten] = useState<WachtKlantProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionTarget, setActionTarget] = useState<{ project: WachtKlantProject; action: 'approve' | 'reject' } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Feedback dialoog state
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [feedbackProject, setFeedbackProject] = useState<WachtKlantProject | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [selectedRejectAction, setSelectedRejectAction] = useState<RejectAction>('feedback_ellen');

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
        dag_van_week: number;
        week_start: string;
        start_uur: number;
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
            taken_details: [],
          };
        }
        grouped[key].taak_ids.push(taak.id);
        grouped[key].totaal_uren += taak.duur_uren;
        if (!grouped[key].medewerkers.includes(taak.werknemer_naam)) {
          grouped[key].medewerkers.push(taak.werknemer_naam);
        }
        // Bewaar taak details voor heropenen template
        grouped[key].taken_details?.push({
          werknemer_naam: taak.werknemer_naam,
          dag_van_week: taak.dag_van_week,
          week_start: taak.week_start,
          start_uur: taak.start_uur,
          duur_uren: taak.duur_uren,
          fase_naam: taak.fase_naam,
        });
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

  // Open feedback dialoog in plaats van direct verwijderen
  function openFeedbackDialog(project: WachtKlantProject) {
    setFeedbackProject(project);
    setFeedbackText('');
    setSelectedRejectAction('feedback_ellen');
    setFeedbackDialogOpen(true);
    setActionTarget(null);
  }

  // Verwerk de feedback actie
  async function handleFeedbackSubmit() {
    if (!feedbackProject) return;

    setIsProcessing(true);
    try {
      if (selectedRejectAction === 'delete') {
        // Direct verwijderen zonder aanpassingen
        for (const taakId of feedbackProject.taak_ids) {
          await secureDelete('taken', [
            { column: 'id', operator: 'eq', value: taakId },
          ]);
        }
        toast({
          title: 'Verwijderd',
          description: `Planning voor ${feedbackProject.klant_naam} is verwijderd.`,
        });
        loadWachtKlantProjecten();
      } else if (selectedRejectAction === 'feedback_ellen') {
        // Navigeer naar Ellen chat met feedback context
        const projectInfo = {
          klant_naam: feedbackProject.klant_naam,
          project_nummer: feedbackProject.project_nummer,
          fase_naam: feedbackProject.fase_naam,
          feedback: feedbackText,
          taken: feedbackProject.taken_details,
          heropend_van: 'wacht_klant',
        };
        // Sla op in localStorage voor Ellen chat
        localStorage.setItem('ellen_feedback_context', JSON.stringify(projectInfo));
        navigate('/ellen-chat');
      } else if (selectedRejectAction === 'manual_edit') {
        // Navigeer naar planner met focus op deze taken
        const eersteWeek = feedbackProject.taken_details?.[0]?.week_start;
        navigate(`/?tab=planner${eersteWeek ? `&week=${eersteWeek}` : ''}`);
        toast({
          title: 'Handmatig aanpassen',
          description: 'Je kunt de taken nu handmatig aanpassen in de planner.',
        });
      }
    } catch (err) {
      toast({
        title: 'Fout',
        description: 'Er ging iets mis.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
      setFeedbackDialogOpen(false);
      setFeedbackProject(null);
    }
  }

  // Legacy functie voor directe afwijzing (nu redirect naar feedback dialoog)
  async function handleReject(project: WachtKlantProject) {
    openFeedbackDialog(project);
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
                : `Hoe wil je de afwijzing verwerken voor "${actionTarget?.project.klant_naam}"?`}
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
              {isProcessing ? 'Bezig...' : (actionTarget?.action === 'approve' ? 'Goedkeuren' : 'Doorgaan')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Feedback Dialoog voor afwijzing */}
      <Dialog open={feedbackDialogOpen} onOpenChange={(open) => !open && setFeedbackDialogOpen(false)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Klant niet akkoord - Feedback</DialogTitle>
            <DialogDescription>
              De klant is niet akkoord met de planning voor {feedbackProject?.klant_naam}. Geef aan wat er moet veranderen.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Actie keuze */}
            <div className="space-y-3">
              <p className="text-sm font-medium">Wat wil je doen?</p>

              <button
                type="button"
                onClick={() => setSelectedRejectAction('feedback_ellen')}
                className={`w-full flex items-start gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                  selectedRejectAction === 'feedback_ellen'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/50'
                }`}
              >
                <MessageSquare className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm">Feedback aan Ellen geven</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Ellen past de planning aan op basis van je feedback
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedRejectAction('manual_edit')}
                className={`w-full flex items-start gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                  selectedRejectAction === 'manual_edit'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/50'
                }`}
              >
                <Edit3 className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm">Handmatig aanpassen</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Open de planner en pas de blokken zelf aan
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedRejectAction('delete')}
                className={`w-full flex items-start gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                  selectedRejectAction === 'delete'
                    ? 'border-destructive bg-destructive/5'
                    : 'border-border hover:border-muted-foreground/50'
                }`}
              >
                <Trash2 className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm">Planning verwijderen</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Verwijder de hele planning en begin opnieuw
                  </p>
                </div>
              </button>
            </div>

            {/* Feedback tekstveld - alleen tonen bij Ellen feedback */}
            {selectedRejectAction === 'feedback_ellen' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Wat moet er anders?
                </label>
                <Textarea
                  placeholder="Bijv. 'De klant wil de presentatie op vrijdag in plaats van woensdag' of 'Er moet meer tijd tussen de conceptfase en de productie'"
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  Wees zo specifiek mogelijk zodat Ellen de juiste aanpassingen kan maken.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFeedbackDialogOpen(false)}
              disabled={isProcessing}
            >
              Annuleren
            </Button>
            <Button
              onClick={handleFeedbackSubmit}
              disabled={isProcessing || (selectedRejectAction === 'feedback_ellen' && !feedbackText.trim())}
              className={selectedRejectAction === 'delete' ? 'bg-destructive hover:bg-destructive/90' : ''}
            >
              {isProcessing ? 'Bezig...' : (
                selectedRejectAction === 'delete' ? 'Verwijderen' :
                selectedRejectAction === 'manual_edit' ? 'Naar planner' :
                'Naar Ellen'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
