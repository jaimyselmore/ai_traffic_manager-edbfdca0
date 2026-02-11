import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2, CheckCircle2, XCircle, ArrowLeft, Send, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { getSessionToken } from '@/lib/data/secureDataClient';
import { saveAanvraag } from '@/components/dashboard/MijnAanvragen';
import { createProjectAndSchedule } from '@/lib/services/planningAutomation';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

type FlowState = 'ellen-working' | 'voorstel' | 'client-check' | 'placing' | 'done' | 'error';

interface VoorstelTaak {
  werknemer_naam: string;
  fase_naam: string;
  dag_van_week: number;
  week_start: string;
  start_uur: number;
  duur_uren: number;
}

const DAG_NAMEN = ['Ma', 'Di', 'Wo', 'Do', 'Vr'];
const TIME_SLOTS = [9, 10, 11, 12, 13, 14, 15, 16, 17];

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
  const { user } = useAuth();
  const formData = location.state?.formData;
  const projectInfo = location.state?.projectInfo;

  const [flowState, setFlowState] = useState<FlowState>('ellen-working');
  const [voorstellen, setVoorstellen] = useState<VoorstelTaak[]>([]);
  const [ellenMessage, setEllenMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [activeStep, setActiveStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(0);

  // Workflow step animation
  useEffect(() => {
    if (flowState !== 'ellen-working') return;

    let stepIndex = 0;
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
          setEllenMessage(data.antwoord || 'Hier is mijn voorstel voor de planning:');
        } else if (data?.antwoord) {
          console.warn('Geen planning_voorstel ontvangen, gebruik fallback. Antwoord:', data.antwoord);
          const defaultTaken = generateDefaultVoorstel(projectInfo);
          setVoorstellen(defaultTaken);
          setEllenMessage(data.antwoord || 'Op basis van je aanvraag heb ik het volgende voorstel gemaakt:');
        } else {
          console.warn('Leeg antwoord van Ellen, gebruik fallback');
          const defaultTaken = generateDefaultVoorstel(projectInfo);
          setVoorstellen(defaultTaken);
          setEllenMessage('Op basis van je aanvraag heb ik het volgende voorstel gemaakt:');
        }
        setFlowState('voorstel');
      } catch (err) {
        console.error('Ellen voorstel error:', err);
        const defaultTaken = generateDefaultVoorstel(projectInfo);
        setVoorstellen(defaultTaken);
        setEllenMessage('Ik heb een planning opgesteld op basis van je aanvraag:');
        setFlowState('voorstel');
      }
    };

    // Wait for all workflow steps to complete visually before showing the voorstel
    const totalWorkflowDuration = WORKFLOW_STEPS.reduce((sum, s) => sum + s.duration + 200, 0) + 500;
    const timer = setTimeout(generateVoorstel, totalWorkflowDuration);
    return () => clearTimeout(timer);
  }, [projectInfo]);

  const handleApprove = () => {
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
      if (!user) throw new Error('Niet ingelogd');

      const result = await createProjectAndSchedule(
        {
          klant_id: projectInfo.klant_id,
          klant_naam: projectInfo.klant_naam,
          projectnaam: projectInfo.projectnaam,
          projectTitel: projectInfo.projectTitel,
          projecttype: projectInfo.projecttype,
          deadline: projectInfo.deadline,
          fases: projectInfo.fases,
        },
        user.id
      );

      if (result.success) {
        saveAanvraag({
          id: `ingediend-${Date.now()}`,
          type: 'nieuw-project',
          status: 'ingediend',
          titel: projectInfo.projectnaam || 'Project',
          klant: projectInfo.klant_naam,
          datum: new Date().toISOString(),
          projectType: projectInfo.projecttype,
        });
        setFlowState('done');
      } else {
        throw new Error(result.errors?.join('\n') || 'Onbekende fout');
      }
    } catch (err) {
      setFlowState('error');
      setErrorMessage(err instanceof Error ? err.message : 'Er ging iets mis bij het aanmaken');
    }
  };

  const handleReject = () => {
    navigate('/nieuw-project');
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

  const currentWeekStart = allWeeks[selectedWeekIndex] || allWeeks[0];
  const currentWeekISO = currentWeekStart.toISOString().split('T')[0];

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
    const names = [...new Set(voorstellen.map(t => t.werknemer_naam))];
    return names;
  }, [voorstellen]);

  // Filter tasks for the currently selected week
  const getTasksForCell = (medewerker: string, dayIndex: number, hour: number) => {
    return voorstellen.filter(t =>
      t.werknemer_naam === medewerker &&
      t.week_start === currentWeekISO &&
      t.dag_van_week === dayIndex &&
      hour >= t.start_uur &&
      hour < t.start_uur + t.duur_uren
    );
  };

  const tasksThisWeek = voorstellen.filter(t => t.week_start === currentWeekISO);

  const isTaskStart = (taak: VoorstelTaak, hour: number) => {
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
                <p className="text-sm text-muted-foreground">{ellenMessage}</p>
              </div>
            </div>

            {/* Project summary */}
            <Card className="p-4 bg-accent/30 border-primary/20">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {projectInfo?.klant_naam} — {projectInfo?.projectnaam}
                </p>
                <p className="text-xs text-muted-foreground">
                  {projectInfo?.projecttype} • {voorstellen.length} blokken
                  {projectInfo?.deadline && ` • Deadline: ${projectInfo.deadline}`}
                </p>
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
              {tasksThisWeek.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm border border-border rounded-lg bg-card">
                  Geen blokken ingepland deze week
                </div>
              )}
              {tasksThisWeek.length > 0 && (
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
                            const cellTasks = getTasksForCell(medewerker, dayIndex, hour);
                            const isLunch = hour === 13;

                            return (
                              <td
                                key={dayIndex}
                                className={cn(
                                  "border-b border-r border-border p-0.5",
                                  isLunch && 'bg-muted/30'
                                )}
                                style={{ height: '28px' }}
                              >
                                {cellTasks.map((taak, ti) => {
                                  if (!isTaskStart(taak, hour)) return null;
                                  return (
                                    <div
                                      key={ti}
                                      className={cn(
                                        'rounded px-1.5 py-0.5 text-xs text-white overflow-hidden h-full opacity-60',
                                        getFaseColor(taak.fase_naam)
                                      )}
                                      title={`${taak.fase_naam} • ${taak.duur_uren}u`}
                                    >
                                      <div className="truncate font-medium">
                                        {projectInfo?.klant_naam}
                                      </div>
                                      <div className="truncate text-[10px] opacity-80">
                                        {taak.fase_naam}
                                      </div>
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
              <p className="text-xs text-muted-foreground">
                Concept-blokken worden semi-transparant weergegeven. Na goedkeuring worden ze vastgezet.
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 pt-4">
              <Button onClick={handleApprove} className="flex-1">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Voorstel goedkeuren
              </Button>
              <Button variant="outline" onClick={handleReject} className="flex-1">
                Aanpassen
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

function buildEllenPrompt(info: any): string {
  const parts: string[] = [];

  // Basisinfo
  parts.push(`PLANNING AANVRAAG — Maak een planningsvoorstel op basis van onderstaande gegevens.`);
  parts.push(`\n## Project`);
  parts.push(`- Klant: "${info.klant_naam}"`);
  parts.push(`- Projectnaam: "${info.projectnaam}"`);
  parts.push(`- Projecttype: ${info.projecttype || 'algemeen'}`);
  if (info.deadline) parts.push(`- Deadline: ${info.deadline}`);

  // Fases met medewerkerdetails
  if (info.fases?.length) {
    parts.push(`\n## Fases en medewerkers`);
    info.fases.forEach((f: any, i: number) => {
      parts.push(`\n### Fase ${i + 1}: ${f.fase_naam}`);
      parts.push(`- Totale duur: ${f.duur_dagen} dagen`);
      if (f.uren_per_dag && f.uren_per_dag !== 8) parts.push(`- Uren per dag: ${f.uren_per_dag}`);
      if (f.start_datum) parts.push(`- Gewenste startdatum: ${f.start_datum}`);
      if (f.notities) parts.push(`- Toelichting: "${f.notities}"`);

      if (f.medewerkers?.length) {
        parts.push(`- Medewerkers: ${f.medewerkers.join(', ')}`);
      }

      // Medewerker-specifieke details (uit het formulier)
      if (f.medewerkerDetails?.length) {
        f.medewerkerDetails.forEach((md: any) => {
          const eenheid = md.eenheid || 'dagen';
          parts.push(`  → ${md.naam}: ${md.inspanning} ${eenheid}${md.toelichting ? ` (Toelichting: "${md.toelichting}")` : ''}`);
        });
      }
    });
  }

  // Instructies voor Ellen
  parts.push(`\n## Instructies`);
  parts.push(`1. Check de beschikbaarheid van ELKE genoemde medewerker voor de relevante weken (gebruik check_beschikbaarheid).`);
  parts.push(`2. Houd rekening met parttime dagen, verlof en bestaande taken.`);
  parts.push(`3. Verdeel de inspanning per medewerker over beschikbare dagen, rekening houdend met de opgegeven toelichting.`);
  parts.push(`4. Genereer een planningsvoorstel met plan_project.`);
  parts.push(`5. Alle taken krijgen status "concept".`);
  parts.push(`6. Respecteer de deadline: plan alles VOOR de deadline in.`);
  parts.push(`7. Gebruik standaard 8 uur per dag tenzij anders aangegeven.`);
  parts.push(`8. Als een medewerker niet beschikbaar is op een gevraagde dag, zoek dan het eerstvolgende vrije moment.`);

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
