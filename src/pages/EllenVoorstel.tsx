import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2, CheckCircle2, XCircle, ArrowLeft, Send, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { getSessionToken, secureSelect } from '@/lib/data/secureDataClient';
import { saveAanvraag } from '@/components/dashboard/MijnAanvragen';
import { toast } from '@/hooks/use-toast';
import { Taak } from '@/lib/data/takenService';

type FlowState = 'ellen-working' | 'voorstel' | 'color-select' | 'client-check' | 'placing' | 'done' | 'error';

// Werktype bepaalt de kleur in de planner
const WERKTYPE_OPTIONS = [
  { id: 'concept', label: 'Conceptontwikkeling', color: 'bg-task-concept', description: 'Brainstorm, ideeën, eerste concepten' },
  { id: 'uitwerking', label: 'Conceptuitwerking', color: 'bg-task-uitwerking', description: 'Uitwerken van goedgekeurd concept' },
  { id: 'productie', label: 'Productie', color: 'bg-task-productie', description: 'Shoot, opnames, productiedagen' },
  { id: 'extern', label: 'Meeting met klant', color: 'bg-task-extern', description: 'Presentatie, call of meeting met klant' },
  { id: 'review', label: 'Interne review', color: 'bg-task-review', description: 'Team-update, interne meeting of review' },
];

interface VoorstelTaak {
  werknemer_naam: string;
  fase_naam: string;
  dag_van_week: number;
  week_start: string;
  start_uur: number;
  duur_uren: number;
}

const DAG_NAMEN = ['Ma', 'Di', 'Wo', 'Do', 'Vr'];
const TIME_SLOTS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18]; // Werkdag 09:00-18:00
const CELL_HEIGHT = 28; // px per hour cell

const WORKFLOW_STEPS = [
  { label: 'Aanvraag analyseren', duration: 1200 },
  { label: 'Beschikbaarheid checken', duration: 1500 },
  { label: 'Planningsregels toepassen', duration: 1000 },
  { label: 'Voorstel samenstellen', duration: 800 },
];

const FASE_COLORS: Record<string, string> = {
  'Conceptontwikkeling': 'bg-[hsl(var(--primary))]',
  'Conceptuitwerking': 'bg-[hsl(195,60%,50%)]',
  'Presentatie': 'bg-[hsl(30,80%,55%)]',
  'Algemeen': 'bg-[hsl(var(--primary))]',
};

export default function EllenVoorstel() {
  const navigate = useNavigate();
  const location = useLocation();
  const projectInfo = location.state?.projectInfo;

  const [flowState, setFlowState] = useState<FlowState>('ellen-working');
  const [voorstellen, setVoorstellen] = useState<VoorstelTaak[]>([]);
  const [, setEllenMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [activeStep, setActiveStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(0);
  const [selectedWerktype, setSelectedWerktype] = useState<string>('concept');
  const [feedbackInput, setFeedbackInput] = useState('');
  const [isRequestingNewProposal, setIsRequestingNewProposal] = useState(false);
  const [bestaandeTaken, setBestaandeTaken] = useState<Taak[]>([]);
  const [, setIsLoadingTaken] = useState(false);

  // Load existing tasks for relevant medewerkers and weeks
  useEffect(() => {
    async function loadBestaandeTaken() {
      if (voorstellen.length === 0) return;

      setIsLoadingTaken(true);
      try {
        // Get unique medewerkers and week_starts from voorstellen
        const medewerkers = [...new Set(voorstellen.map(t => t.werknemer_naam))];
        const weekStarts = [...new Set(voorstellen.map(t => t.week_start))];

        // Load taken for each week (secureSelect doesn't support OR across weeks easily)
        const allTaken: Taak[] = [];
        for (const weekStart of weekStarts) {
          const { data, error } = await secureSelect<Taak>('taken', {
            filters: [{ column: 'week_start', operator: 'eq', value: weekStart }],
          });
          if (!error && data && Array.isArray(data)) {
            // Filter to only include tasks for relevant medewerkers
            const relevantTaken = data.filter(t => medewerkers.includes(t.werknemer_naam));
            allTaken.push(...relevantTaken);
          }
        }
        setBestaandeTaken(allTaken);
      } catch (err) {
        console.error('Error loading existing tasks:', err);
      } finally {
        setIsLoadingTaken(false);
      }
    }

    loadBestaandeTaken();
  }, [voorstellen]);

  // Workflow step animation
  useEffect(() => {
    if (flowState !== 'ellen-working') return;

    let totalDelay = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];

    WORKFLOW_STEPS.forEach((step, i) => {
      // Activate step
      timers.push(setTimeout(() => setActiveStep(i), totalDelay));
      totalDelay += step.duration;
      // Complete step
      timers.push(setTimeout(() => {
        setCompletedSteps(prev => [...prev, i]);
      }, totalDelay));
      totalDelay += 200;
    });

    return () => timers.forEach(clearTimeout);
  }, [flowState]);

  // Generate voorstel after workflow steps complete
  useEffect(() => {
    if (!projectInfo) {
      setFlowState('error');
      setErrorMessage('Geen projectgegevens gevonden. Ga terug en probeer opnieuw.');
      return;
    }

    const generateVoorstel = async () => {
      const sessionToken = getSessionToken();
      if (!sessionToken) {
        setFlowState('error');
        setErrorMessage('Je bent niet ingelogd.');
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke('ellen-chat', {
          headers: { Authorization: `Bearer ${sessionToken}` },
          body: {
            sessie_id: `project-${Date.now()}`,
            bericht: buildEllenPrompt(projectInfo),
          },
        });

        console.log('Ellen response:', { data, error });

        if (error) throw new Error(error.message);

        if (data?.voorstel?.type === 'planning_voorstel' && data.voorstel.taken?.length > 0) {
          setVoorstellen(data.voorstel.taken);
          // Samenvatting wordt nu automatisch gegenereerd op basis van taken
          setEllenMessage('');
        } else if (data?.antwoord) {
          console.warn('Geen planning_voorstel ontvangen, gebruik fallback. Antwoord:', data.antwoord);
          const defaultTaken = generateDefaultVoorstel(projectInfo);
          setVoorstellen(defaultTaken);
          setEllenMessage('');
        } else {
          console.warn('Leeg antwoord van Ellen, gebruik fallback');
          const defaultTaken = generateDefaultVoorstel(projectInfo);
          setVoorstellen(defaultTaken);
          setEllenMessage('');
        }
        setFlowState('voorstel');
      } catch (err) {
        console.error('Ellen voorstel error:', err);
        const defaultTaken = generateDefaultVoorstel(projectInfo);
        setVoorstellen(defaultTaken);
        setEllenMessage('');
        setFlowState('voorstel');
      }
    };

    // Wait for all workflow steps to complete visually before showing the voorstel
    const totalWorkflowDuration = WORKFLOW_STEPS.reduce((sum, s) => sum + s.duration + 200, 0) + 500;
    const timer = setTimeout(generateVoorstel, totalWorkflowDuration);
    return () => clearTimeout(timer);
  }, [projectInfo]);

  const handleApprove = () => {
    setFlowState('color-select');
  };

  const handleColorSelected = () => {
    setFlowState('client-check');
  };

  const handleClientApprovalNeeded = async (needsClientApproval: boolean) => {
    if (needsClientApproval) {
      saveAanvraag({
        id: `wacht-klant-${Date.now()}`,
        type: 'nieuw-project',
        status: 'concept',
        titel: projectInfo?.projectnaam || 'Project',
        klant: projectInfo?.klant_naam,
        datum: new Date().toISOString(),
        projectType: projectInfo?.projecttype,
      });
      toast({
        title: 'Voorstel opgeslagen',
        description: 'Het voorstel wacht op goedkeuring van de klant. Je vindt het terug bij "Mijn aanvragen".',
      });
      navigate('/');
      return;
    }

    setFlowState('placing');
    try {
      const sessionToken = getSessionToken();
      if (!sessionToken) throw new Error('Niet ingelogd');

      // Gebruik de Edge Function met het geselecteerde werktype
      const { data, error } = await supabase.functions.invoke('ellen-chat', {
        headers: { Authorization: `Bearer ${sessionToken}` },
        body: {
          sessie_id: `project-${Date.now()}`,
          actie: 'plannen',
          werktype: selectedWerktype,
          planning: {
            klant_naam: projectInfo.klant_naam,
            project_nummer: `P-${Date.now().toString().slice(-6)}`,
            project_omschrijving: projectInfo.projectnaam,
            projecttype: projectInfo.projecttype,
            deadline: projectInfo.deadline,
            taken: voorstellen.map(t => ({
              ...t,
              werktype: selectedWerktype,
            })),
          },
        },
      });

      if (error) throw new Error(error.message);

      if (data?.success) {
        // Template is al opgeslagen in NieuwProject.tsx - geen nieuwe entry nodig
        setFlowState('done');
      } else {
        throw new Error(data?.message || 'Onbekende fout');
      }
    } catch (err) {
      setFlowState('error');
      setErrorMessage(err instanceof Error ? err.message : 'Er ging iets mis bij het aanmaken');
    }
  };

  const handleReject = () => {
    navigate('/nieuw-project');
  };

  const handleRequestNewProposal = async () => {
    if (!feedbackInput.trim()) return;

    setIsRequestingNewProposal(true);
    setEllenMessage('Even kijken, ik pas het voorstel aan...');

    try {
      const sessionToken = getSessionToken();
      if (!sessionToken) throw new Error('Niet ingelogd');

      // Sla feedback op voor Ellen om van te leren
      try {
        await supabase.functions.invoke('ellen-chat', {
          headers: { Authorization: `Bearer ${sessionToken}` },
          body: {
            sessie_id: `feedback-${Date.now()}`,
            actie: 'feedback_opslaan',
            feedback: feedbackInput,
            context: {
              project_info: projectInfo,
              vorig_voorstel: voorstellen,
            },
          },
        });
      } catch {
        // Feedback opslaan mag niet falen - ga gewoon door
        console.warn('Feedback opslaan mislukt, ga door met nieuw voorstel');
      }

      const { data, error } = await supabase.functions.invoke('ellen-chat', {
        headers: { Authorization: `Bearer ${sessionToken}` },
        body: {
          sessie_id: `project-${Date.now()}`,
          bericht: buildEllenPrompt(projectInfo, feedbackInput),
        },
      });

      if (error) throw new Error(error.message);

      if (data?.voorstel?.type === 'planning_voorstel' && data.voorstel.taken?.length > 0) {
        setVoorstellen(data.voorstel.taken);
        // Niet Ellen's tekst gebruiken - samenvatting wordt automatisch gegenereerd
        setEllenMessage('');
      } else if (data?.antwoord) {
        // Fallback - Ellen heeft geen tool gebruikt
        const defaultTaken = generateDefaultVoorstel(projectInfo);
        setVoorstellen(defaultTaken);
        setEllenMessage('');
      }

      setFeedbackInput('');
    } catch (err) {
      setEllenMessage(`Sorry, er ging iets mis: ${err instanceof Error ? err.message : 'Onbekende fout'}`);
    } finally {
      setIsRequestingNewProposal(false);
    }
  };

  // Calculate all weeks from first task week to deadline
  const allWeeks = useMemo(() => {
    if (voorstellen.length === 0) return [new Date()];

    // Get all unique week_start values
    const weekStarts = [...new Set(voorstellen.map(t => t.week_start))].sort();
    const firstWeek = new Date(weekStarts[0] + 'T00:00:00');

    // Determine end date: deadline or last task week
    let endDate: Date;
    if (projectInfo?.deadline) {
      endDate = new Date(projectInfo.deadline + 'T00:00:00');
    } else {
      const lastWeek = new Date(weekStarts[weekStarts.length - 1] + 'T00:00:00');
      lastWeek.setDate(lastWeek.getDate() + 4); // Friday of last week
      endDate = lastWeek;
    }

    // Generate all Monday dates from first to end
    const weeks: Date[] = [];
    const current = new Date(firstWeek);
    while (current <= endDate) {
      weeks.push(new Date(current));
      current.setDate(current.getDate() + 7);
    }
    // Ensure at least the weeks with tasks are included
    if (weeks.length === 0) weeks.push(firstWeek);
    return weeks;
  }, [voorstellen, projectInfo?.deadline]);

  // Generate planning summary from actual tasks (not Ellen's text)
  const planningSamenvatting = useMemo(() => {
    if (voorstellen.length === 0) return '';

    // Group tasks by medewerker
    const perMedewerker: Record<string, VoorstelTaak[]> = {};
    voorstellen.forEach(t => {
      if (!perMedewerker[t.werknemer_naam]) {
        perMedewerker[t.werknemer_naam] = [];
      }
      perMedewerker[t.werknemer_naam].push(t);
    });

    const lines: string[] = [];
    const dagNamen = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag'];
    const maandNamen = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

    Object.entries(perMedewerker).forEach(([naam, taken]) => {
      // Calculate total hours for this medewerker
      const totaalUren = taken.reduce((sum, t) => sum + t.duur_uren, 0);
      const aantalDagen = taken.length;

      // Get date range
      const sortedTaken = [...taken].sort((a, b) => {
        if (a.week_start !== b.week_start) return a.week_start.localeCompare(b.week_start);
        return a.dag_van_week - b.dag_van_week;
      });

      const eersteWeek = new Date(sortedTaken[0].week_start + 'T00:00:00');
      eersteWeek.setDate(eersteWeek.getDate() + sortedTaken[0].dag_van_week);
      const laatsteWeek = new Date(sortedTaken[sortedTaken.length - 1].week_start + 'T00:00:00');
      laatsteWeek.setDate(laatsteWeek.getDate() + sortedTaken[sortedTaken.length - 1].dag_van_week);

      // Format: "Jaimy: 3 dagen (24u) van ma 24 feb t/m wo 26 feb"
      const startDag = dagNamen[sortedTaken[0].dag_van_week];
      const eindDag = dagNamen[sortedTaken[sortedTaken.length - 1].dag_van_week];
      const startDatum = `${eersteWeek.getDate()} ${maandNamen[eersteWeek.getMonth()]}`;
      const eindDatum = `${laatsteWeek.getDate()} ${maandNamen[laatsteWeek.getMonth()]}`;

      if (aantalDagen === 1) {
        lines.push(`• ${naam}: ${aantalDagen} dag (${totaalUren}u) op ${startDag} ${startDatum}`);
      } else {
        lines.push(`• ${naam}: ${aantalDagen} dagen (${totaalUren}u) van ${startDag} ${startDatum} t/m ${eindDag} ${eindDatum}`);
      }
    });

    return lines.join('\n');
  }, [voorstellen]);

  const currentWeekStart = allWeeks[selectedWeekIndex] || allWeeks[0];
  // Format as YYYY-MM-DD without timezone conversion (toISOString converts to UTC which shifts dates)
  const currentWeekISO = `${currentWeekStart.getFullYear()}-${String(currentWeekStart.getMonth() + 1).padStart(2, '0')}-${String(currentWeekStart.getDate()).padStart(2, '0')}`;

  const weekDates = useMemo(() => {
    return DAG_NAMEN.map((_, index) => {
      const date = new Date(currentWeekStart);
      date.setDate(date.getDate() + index);
      return date;
    });
  }, [currentWeekStart]);

  // Format week label like "Week 12 – 17 t/m 21 maart 2026"
  const weekLabel = useMemo(() => {
    const monday = weekDates[0];
    const friday = weekDates[4];
    const weekNum = getWeekNumber(monday);
    const months = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
    const monthName = months[friday.getMonth()];
    return `Week ${weekNum} – ${monday.getDate()} t/m ${friday.getDate()} ${monthName} ${friday.getFullYear()}`;
  }, [weekDates]);

  const medewerkers = useMemo(() => {
    // Include medewerkers from both proposed and existing tasks
    const voorstelNames = voorstellen.map(t => t.werknemer_naam);
    const bestaandeNames = bestaandeTaken
      .filter(t => voorstelNames.some(vn => t.werknemer_naam === vn || voorstellen.length === 0))
      .map(t => t.werknemer_naam);
    const names = [...new Set([...voorstelNames, ...bestaandeNames])];
    return names;
  }, [voorstellen, bestaandeTaken]);

  // Filter PROPOSED tasks for the currently selected week
  const getVoorstelTasksForCell = (medewerker: string, dayIndex: number, hour: number) => {
    return voorstellen.filter(t =>
      t.werknemer_naam === medewerker &&
      t.week_start === currentWeekISO &&
      t.dag_van_week === dayIndex &&
      hour >= t.start_uur &&
      hour < t.start_uur + t.duur_uren
    );
  };

  // Filter EXISTING tasks for the currently selected week
  const getBestaandeTasksForCell = (medewerker: string, dayIndex: number, hour: number) => {
    return bestaandeTaken.filter(t =>
      t.werknemer_naam === medewerker &&
      t.week_start === currentWeekISO &&
      t.dag_van_week === dayIndex &&
      hour >= t.start_uur &&
      hour < t.start_uur + t.duur_uren
    );
  };

  const tasksThisWeek = voorstellen.filter(t => t.week_start === currentWeekISO);
  const bestaandeThisWeek = bestaandeTaken.filter(t => t.week_start === currentWeekISO);

  const isTaskStart = (taak: VoorstelTaak | Taak, hour: number) => {
    return hour === taak.start_uur;
  };

  const getFaseColor = (faseNaam: string) => {
    return FASE_COLORS[faseNaam] || FASE_COLORS['Algemeen'];
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="w-full px-6 pt-6 mb-4">
        <button
          type="button"
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
          onClick={() => navigate('/nieuw-project')}
        >
          <ArrowLeft className="h-3 w-3" />
          Terug naar formulier
        </button>
      </div>

      <div className="max-w-5xl mx-auto px-6 pb-24">
        {/* Ellen Working State with workflow steps */}
        {flowState === 'ellen-working' && (
          <div className="flex flex-col items-center justify-center py-16 space-y-8">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-3xl">🤖</span>
              </div>
              <div className="absolute -bottom-1 -right-1">
                <Loader2 className="h-6 w-6 text-primary animate-spin" />
              </div>
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-xl font-semibold text-foreground">Ellen is aan het werk...</h2>
            </div>

            {/* Workflow steps */}
            <div className="w-full max-w-sm space-y-3">
              {WORKFLOW_STEPS.map((step, i) => {
                const isCompleted = completedSteps.includes(i);
                const isActive = activeStep === i && !isCompleted;
                return (
                  <div
                    key={i}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg transition-all duration-300',
                      isActive && 'bg-primary/5 border border-primary/20',
                      isCompleted && 'bg-muted/50',
                      !isActive && !isCompleted && 'opacity-40'
                    )}
                  >
                    <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                      {isCompleted ? (
                        <Check className="h-4 w-4 text-primary" />
                      ) : isActive ? (
                        <Loader2 className="h-4 w-4 text-primary animate-spin" />
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                      )}
                    </div>
                    <span className={cn(
                      'text-sm',
                      isActive && 'text-foreground font-medium',
                      isCompleted && 'text-muted-foreground',
                      !isActive && !isCompleted && 'text-muted-foreground'
                    )}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Voorstel State with mini planner */}
        {flowState === 'voorstel' && (
          <div className="space-y-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-lg">🤖</span>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Ellen</p>
                <p className="text-sm text-muted-foreground">
                  Hier is mijn voorstel voor de planning:
                </p>
              </div>
            </div>

            {/* Project summary with generated planning details */}
            <Card className="p-4 bg-accent/30 border-primary/20">
              <div className="space-y-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    {projectInfo?.klant_naam} — {projectInfo?.projectnaam}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {projectInfo?.projecttype} • {voorstellen.length} blokken
                    {projectInfo?.deadline && ` • Deadline: ${projectInfo.deadline}`}
                  </p>
                </div>
                {planningSamenvatting && (
                  <div className="pt-2 border-t border-border/50">
                    <p className="text-xs font-medium text-foreground mb-1">Planning overzicht:</p>
                    <p className="text-xs text-muted-foreground whitespace-pre-line">
                      {planningSamenvatting}
                    </p>
                  </div>
                )}
              </div>
            </Card>

            {/* Mini Planner Grid with week navigation */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Voorgestelde planning</h3>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={selectedWeekIndex === 0}
                    onClick={() => setSelectedWeekIndex(i => i - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium text-foreground min-w-[260px] text-center">
                    {weekLabel}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={selectedWeekIndex >= allWeeks.length - 1}
                    onClick={() => setSelectedWeekIndex(i => i + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground ml-2">
                    {selectedWeekIndex + 1} / {allWeeks.length}
                  </span>
                </div>
              </div>
              {tasksThisWeek.length === 0 && bestaandeThisWeek.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm border border-border rounded-lg bg-card">
                  Geen blokken in deze week
                </div>
              )}
              {(tasksThisWeek.length > 0 || bestaandeThisWeek.length > 0) && (
              <div className="w-full rounded-lg border border-border bg-card overflow-x-auto">
                <table className="w-full border-collapse table-fixed min-w-[700px]">
                  <thead>
                    <tr className="bg-secondary">
                      <th className="border-b border-r border-border px-4 py-3 text-left text-sm font-medium text-muted-foreground w-44">
                        Medewerker
                      </th>
                      <th className="border-b border-r border-border px-1 py-3 text-center text-xs font-medium text-muted-foreground w-12">
                        Uur
                      </th>
                      {weekDates.map((date, index) => (
                        <th
                          key={index}
                          className="border-b border-r border-border px-2 py-3 text-center text-sm font-medium text-foreground"
                        >
                          <div>{DAG_NAMEN[index]}</div>
                          <div className="text-xs text-muted-foreground">
                            {date.getDate()}/{date.getMonth() + 1}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {medewerkers.map((medewerker) => (
                      TIME_SLOTS.map((hour, hourIndex) => (
                        <tr key={`${medewerker}-${hour}`} className={cn(
                          hour === 13 && 'bg-muted/30'
                        )}>
                          {hourIndex === 0 && (
                            <td
                              rowSpan={TIME_SLOTS.length}
                              className="bg-card border-b border-r border-border px-4 py-2 align-top"
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                                  {medewerker.split(' ').map(n => n[0]).join('')}
                                </div>
                                <div className="font-medium text-foreground text-sm">{medewerker}</div>
                              </div>
                            </td>
                          )}
                          <td className={cn(
                            "border-b border-r border-border px-1 py-1 text-center text-xs font-medium",
                            hour === 13 ? 'bg-muted/30 text-muted-foreground' : 'bg-card text-muted-foreground'
                          )}>
                            {hour === 13 ? '🍽️' : `${hour.toString().padStart(2, '0')}:00`}
                          </td>
                          {weekDates.map((_, dayIndex) => {
                            const voorstelTasks = getVoorstelTasksForCell(medewerker, dayIndex, hour);
                            const bestaandeTasks = getBestaandeTasksForCell(medewerker, dayIndex, hour);
                            const isLunch = hour === 13;

                            return (
                              <td
                                key={dayIndex}
                                className={cn(
                                  "border-b border-r border-border p-0 relative",
                                  isLunch && 'bg-muted/30'
                                )}
                                style={{ height: `${CELL_HEIGHT}px` }}
                              >
                                {/* Bestaande taken (solid, met grijze kleur) */}
                                {bestaandeTasks.map((taak, ti) => {
                                  if (!isTaskStart(taak, hour)) return null;
                                  // Calculate block height based on duration
                                  const maxHours = 18 - hour;
                                  const displayHours = Math.min(taak.duur_uren, maxHours);
                                  const blockHeight = displayHours * CELL_HEIGHT;
                                  return (
                                    <div
                                      key={`bestaand-${ti}`}
                                      className="absolute left-0.5 right-0.5 rounded px-1.5 py-0.5 text-xs text-white overflow-hidden bg-slate-400 z-10"
                                      style={{
                                        height: `${blockHeight - 2}px`,
                                        top: '1px'
                                      }}
                                      title={`${taak.klant_naam} • ${taak.fase_naam} • ${taak.duur_uren}u (bestaand)`}
                                    >
                                      <div className="truncate font-medium">
                                        {taak.klant_naam}
                                      </div>
                                      <div className="truncate text-[10px] opacity-80">
                                        {taak.fase_naam}
                                      </div>
                                      {taak.duur_uren > 2 && (
                                        <div className="text-[10px] opacity-70 mt-0.5">
                                          {taak.duur_uren}u
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                                {/* Voorgestelde taken (semi-transparant, met kleur) */}
                                {voorstelTasks.map((taak, ti) => {
                                  if (!isTaskStart(taak, hour)) return null;
                                  // Calculate block height based on duration
                                  const maxHours = 18 - hour;
                                  const displayHours = Math.min(taak.duur_uren, maxHours);
                                  const blockHeight = displayHours * CELL_HEIGHT;
                                  return (
                                    <div
                                      key={`voorstel-${ti}`}
                                      className={cn(
                                        'absolute left-0.5 right-0.5 rounded px-1.5 py-0.5 text-xs text-white overflow-hidden opacity-80 border-2 border-dashed border-white/50 z-20',
                                        getFaseColor(taak.fase_naam)
                                      )}
                                      style={{
                                        height: `${blockHeight - 2}px`,
                                        top: '1px'
                                      }}
                                      title={`${projectInfo?.projectTitel || projectInfo?.klant_naam} • ${taak.fase_naam} • ${taak.duur_uren}u (voorstel)`}
                                    >
                                      <div className="truncate font-medium">
                                        {projectInfo?.projectTitel || projectInfo?.klant_naam}
                                      </div>
                                      <div className="truncate text-[10px] opacity-80">
                                        {taak.fase_naam}
                                      </div>
                                      {taak.duur_uren > 2 && (
                                        <div className="text-[10px] opacity-70 mt-0.5">
                                          {taak.duur_uren}u
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    ))}
                  </tbody>
                </table>
              </div>
              )}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-3 rounded bg-slate-400"></div>
                  <span>Bestaande planning</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-3 rounded bg-primary/60 border border-dashed border-primary"></div>
                  <span>Nieuw voorstel</span>
                </div>
              </div>
            </div>

            {/* Feedback section - connected input en knop */}
            <div className="space-y-3 pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Niet helemaal goed? Geef feedback en genereer een nieuw voorstel.
              </p>
              <div className="rounded-lg border border-border bg-secondary/20 p-3 space-y-3">
                <textarea
                  placeholder="Wat moet er anders? Bijv. 'Verschuif alles naar volgende week', 'Plan tot 18:00', of 'Ik wil Jakko erbij'"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                  rows={2}
                  value={feedbackInput}
                  onChange={(e) => setFeedbackInput(e.target.value)}
                  disabled={isRequestingNewProposal}
                />
                <Button
                  onClick={handleRequestNewProposal}
                  disabled={isRequestingNewProposal || !feedbackInput.trim()}
                  className="w-full"
                >
                  {isRequestingNewProposal ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Nieuw voorstel genereren
                </Button>
                {!feedbackInput.trim() && (
                  <p className="text-xs text-muted-foreground text-center">
                    Vul hierboven in wat je wilt veranderen
                  </p>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 pt-4">
              <Button onClick={handleApprove} className="flex-1">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Voorstel goedkeuren
              </Button>
              <Button variant="outline" onClick={handleReject} className="flex-1">
                Terug naar formulier
              </Button>
            </div>
          </div>
        )}

        {/* Color/Werktype Selection */}
        {flowState === 'color-select' && (
          <div className="space-y-6 py-8">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-lg">🤖</span>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Ellen</p>
                <p className="text-sm text-muted-foreground">
                  In welke fase zitten we? Dit bepaalt de kleur van de blokken in de planner.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
              {WERKTYPE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setSelectedWerktype(option.id)}
                  className={cn(
                    'flex items-start gap-3 p-4 rounded-xl border-2 transition-all text-left',
                    selectedWerktype === option.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-muted-foreground/50'
                  )}
                >
                  <div className={cn('w-5 h-5 rounded mt-0.5 flex-shrink-0', option.color)} />
                  <div>
                    <p className="font-medium text-foreground text-sm">{option.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{option.description}</p>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex justify-center pt-4">
              <Button onClick={handleColorSelected} className="min-w-[200px]">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Doorgaan
              </Button>
            </div>
          </div>
        )}

        {/* Client Approval Check */}
        {flowState === 'client-check' && (
          <div className="space-y-6 py-8">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-lg">🤖</span>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Ellen</p>
                <p className="text-sm text-muted-foreground">
                  Top! Moet dit voorstel eerst nog goedgekeurd worden door de klant?
                </p>
              </div>
            </div>

            <div className="flex gap-3 max-w-md mx-auto">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => handleClientApprovalNeeded(true)}
              >
                <Send className="h-4 w-4 mr-2" />
                Ja, klant moet goedkeuren
              </Button>
              <Button
                className="flex-1"
                onClick={() => handleClientApprovalNeeded(false)}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Nee, direct inplannen
              </Button>
            </div>
          </div>
        )}

        {/* Placing State */}
        {flowState === 'placing' && (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <p className="text-muted-foreground text-sm">Planning wordt geplaatst...</p>
          </div>
        )}

        {/* Done State */}
        {flowState === 'done' && (
          <div className="flex flex-col items-center justify-center py-20 space-y-6">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-xl font-semibold text-foreground">Planning is geplaatst!</h2>
              <p className="text-muted-foreground text-sm">
                De concept-blokken staan in de planner. Je kunt ze daar reviewen en vastzetten.
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => navigate('/')}>
                Terug naar dashboard
              </Button>
              <Button onClick={() => navigate('/planner')}>
                Bekijk in planner
              </Button>
            </div>
          </div>
        )}

        {/* Error State */}
        {flowState === 'error' && (
          <div className="flex flex-col items-center justify-center py-20 space-y-6">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-xl font-semibold text-foreground">Er ging iets mis</h2>
              <p className="text-muted-foreground text-sm max-w-md">{errorMessage}</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => navigate('/')}>
                Terug naar dashboard
              </Button>
              <Button onClick={() => navigate('/nieuw-project')}>
                Opnieuw proberen
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Analyseer notities en bepaal de verdeling automatisch
 * Dit voorkomt dat OpenAI moet interpreteren
 */
function analyseNotities(notities: string | undefined): {
  verdeling: 'aaneengesloten' | 'per_week' | 'laatste_week';
  dagen_per_week?: number;
  uren_per_dag?: number;
} {
  if (!notities) return { verdeling: 'aaneengesloten' };

  const lower = notities.toLowerCase();

  // Check voor "laatste week" / "aan het eind" patronen
  if (lower.includes('laatste week') || lower.includes('aan het eind') ||
      lower.includes('einde van') || lower.includes('helemaal aan het eind')) {
    return { verdeling: 'laatste_week' };
  }

  // Check voor "X dag per week" patronen
  const dagPerWeekMatch = lower.match(/(\d+)\s*dag(?:en)?\s*per\s*week/);
  if (dagPerWeekMatch) {
    return { verdeling: 'per_week', dagen_per_week: parseInt(dagPerWeekMatch[1]) };
  }

  // Check voor "1 dag per week" of "wekelijks" of "elke week" patronen
  if (lower.includes('per week') || lower.includes('wekelijks') ||
      (lower.includes('elke week') && !lower.includes('elke dag'))) {
    return { verdeling: 'per_week', dagen_per_week: 1 };
  }

  // Check voor "X uur per week" patronen → converteer naar dagen
  const uurPerWeekMatch = lower.match(/(\d+)\s*(?:uur|u|uurtje)?\s*per\s*week/);
  if (uurPerWeekMatch) {
    const uren = parseInt(uurPerWeekMatch[1]);
    // Als het minder dan 4 uur is, plan als 1 dag met die uren
    return { verdeling: 'per_week', dagen_per_week: 1, uren_per_dag: Math.min(uren, 8) };
  }

  // Check voor korte feedback sessies
  if (lower.includes('uurtje') || lower.includes('feedback') || lower.includes('review')) {
    // Als er "uurtje" staat, waarschijnlijk kort en verspreid
    if (lower.includes('elke week') || lower.includes('wekelijks')) {
      return { verdeling: 'per_week', dagen_per_week: 1, uren_per_dag: 1 };
    }
  }

  // Default: aaneengesloten
  return { verdeling: 'aaneengesloten' };
}

function buildEllenPrompt(info: any, feedback?: string): string {
  const parts: string[] = [];

  // KRITIEKE INSTRUCTIE BOVENAAN
  parts.push(`⚠️ KRITIEKE INSTRUCTIE: Je MOET de plan_project tool aanroepen!`);
  parts.push(`Beschrijf de planning NIET in tekst - gebruik ALLEEN de tool.`);
  parts.push(`\n---\n`);

  // Basisinfo
  parts.push(`## Planning Aanvraag`);
  parts.push(`- Klant: "${info.klant_naam}"`);
  parts.push(`- Project: "${info.projectTitel || info.projectnaam}"`);
  parts.push(`- Type: ${info.projecttype || 'algemeen'}`);
  parts.push(`- Intern: ${info.isInternProject ? 'JA' : 'NEE'}`);
  if (info.deadline) parts.push(`- Deadline: ${info.deadline}`);

  // KRITIEK: Alle medewerkers starten PARALLEL op dezelfde datum!
  parts.push(`\n## ⚠️ BELANGRIJK: PARALLELLE PLANNING!`);
  parts.push(`Alle medewerkers starten op DEZELFDE startdatum en werken TEGELIJK.`);
  parts.push(`Dit is GEEN sequentiële planning - iedereen begint parallel!`);

  // Betrokken personen
  if (info.betrokkenPersonen?.length > 0) {
    parts.push(`\n## Overige betrokkenen (voor meetings)`);
    parts.push(`${info.betrokkenPersonen.join(', ')}`);
  }

  // Meetings
  if (info.meetings?.length > 0) {
    parts.push(`\n## Meetings/Presentaties`);
    info.meetings.forEach((m: any, i: number) => {
      const typeLabels: Record<string, string> = {
        'kick-off': 'Kick-off',
        'tussentijds': 'Tussentijdse presentatie',
        'eindpresentatie': 'Eindpresentatie',
        'anders': 'Meeting',
      };
      parts.push(`${i + 1}. ${typeLabels[m.type] || m.type} (${m.aantalUren}u)${m.notitie ? ` - "${m.notitie}"` : ''}`);
    });
  }

  // Pre-analyseer alle fases en bepaal de verdeling
  const geanalyseerde_fases: any[] = [];
  if (info.fases?.length) {
    info.fases.forEach((f: any) => {
      const analyse = analyseNotities(f.notities);
      geanalyseerde_fases.push({
        fase_naam: f.fase_naam,
        medewerkers: f.medewerkers || [],
        start_datum: f.start_datum,
        duur_dagen: f.duur_dagen,
        uren_per_dag: analyse.uren_per_dag || f.uren_per_dag || 8,
        verdeling: analyse.verdeling,
        dagen_per_week: analyse.dagen_per_week,
        notities: f.notities,
      });
    });
  }

  // Fases met VOORGEKAUWDE verdeling
  if (geanalyseerde_fases.length > 0) {
    parts.push(`\n## Medewerkers (PARALLEL, allen starten ${geanalyseerde_fases[0]?.start_datum})`);
    geanalyseerde_fases.forEach((f: any) => {
      parts.push(`\n### ${f.medewerkers?.[0] || f.fase_naam}`);
      parts.push(`- Medewerker: ${f.medewerkers?.join(', ') || f.fase_naam}`);
      parts.push(`- Totaal dagen: ${f.duur_dagen}`);
      parts.push(`- Start: ${f.start_datum}`);
      parts.push(`- Uren/dag: ${f.uren_per_dag}`);
      parts.push(`- **VERDELING: ${f.verdeling.toUpperCase()}**`);
      if (f.verdeling === 'per_week') {
        parts.push(`- Dagen per week: ${f.dagen_per_week || 1}`);
      }
      if (f.notities) {
        parts.push(`- Toelichting: "${f.notities}"`);
      }
    });
  }

  // Feedback
  if (feedback) {
    parts.push(`\n## Feedback op vorig voorstel`);
    parts.push(`"${feedback}"`);
  }

  // Actie met EXACTE fases array
  parts.push(`\n## ACTIE`);
  parts.push(`Roep plan_project aan met EXACT deze parameters:`);
  parts.push(`\`\`\`json`);
  parts.push(JSON.stringify({
    klant_naam: info.klant_naam,
    project_naam: info.projectTitel || info.projectnaam,
    projecttype: info.projecttype || 'algemeen',
    deadline: info.deadline || undefined,
    fases: geanalyseerde_fases.map(f => ({
      fase_naam: f.medewerkers?.[0] || f.fase_naam,
      medewerkers: f.medewerkers || [f.fase_naam],
      start_datum: f.start_datum,
      duur_dagen: f.duur_dagen,
      uren_per_dag: f.uren_per_dag,
      verdeling: f.verdeling,
      dagen_per_week: f.dagen_per_week,
    })),
    betrokken_personen: info.betrokkenPersonen?.length > 0 ? info.betrokkenPersonen : undefined,
  }, null, 2));
  parts.push(`\`\`\``);
  parts.push(`\nGeef daarna een KORTE samenvatting (1-2 zinnen).`);

  return parts.join('\n');
}

function generateDefaultVoorstel(info: any): VoorstelTaak[] {
  const taken: VoorstelTaak[] = [];
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + daysUntilMonday);
  const weekStart = nextMonday.toISOString().split('T')[0];

  if (info.fases?.length) {
    let currentDay = 0;
    for (const fase of info.fases) {
      const medewerkers = fase.medewerkers || [];
      const dagen = fase.duur_dagen || 1;

      if (medewerkers.length === 0) {
        // Fallback: single block
        for (let d = 0; d < dagen && currentDay < 5; d++) {
          taken.push({
            werknemer_naam: 'Medewerker',
            fase_naam: fase.fase_naam,
            dag_van_week: currentDay % 5,
            week_start: weekStart,
            start_uur: 9,
            duur_uren: fase.uren_per_dag || 8,
          });
          currentDay++;
        }
      } else {
        // Distribute days across medewerkers
        const dagenPerMedewerker = Math.max(1, Math.ceil(dagen / medewerkers.length));
        let day = currentDay;
        for (const mw of medewerkers) {
          for (let d = 0; d < dagenPerMedewerker && day < currentDay + dagen && day < 5; d++) {
            taken.push({
              werknemer_naam: mw,
              fase_naam: fase.fase_naam,
              dag_van_week: day % 5,
              week_start: weekStart,
              start_uur: 9,
              duur_uren: fase.uren_per_dag || 8,
            });
            day++;
          }
        }
        currentDay = day;
      }
    }
  }

  return taken;
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
