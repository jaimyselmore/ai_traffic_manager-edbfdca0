import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2, CheckCircle2, XCircle, ArrowLeft, Send, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { getSessionToken, secureSelect, secureInsert } from '@/lib/data/secureDataClient';
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
  werktype?: string; // concept, uitwerking, productie, extern, review
}

const DAG_NAMEN = ['Ma', 'Di', 'Wo', 'Do', 'Vr'];

/**
 * Strip markdown formatting en maak tekst menselijk leesbaar
 */
function cleanEllenText(text: string): string {
  if (!text) return '';
  let cleaned = text
    // Remove markdown bold/italic
    .replace(/\*\*\*(.*?)\*\*\*/g, '$1')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    // Remove markdown headers
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bullet points and numbered lists
    .replace(/^[-•]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    // Remove excessive newlines
    .replace(/\n{3,}/g, '\n\n')
    // Remove ALLCAPS words (more than 3 chars all caps) and replace with normal case
    .replace(/\b([A-Z]{4,})\b/g, (match) => match.charAt(0) + match.slice(1).toLowerCase())
    // Clean up whitespace
    .trim();
  // Take only first ~300 chars to keep it short
  if (cleaned.length > 300) {
    const cutoff = cleaned.lastIndexOf('.', 300);
    cleaned = cleaned.substring(0, cutoff > 150 ? cutoff + 1 : 300).trim();
  }
  return cleaned;
}
const TIME_SLOTS = [9, 10, 11, 12, 13, 14, 15, 16, 17]; // Werkdag 09:00 tot 18:00, zonder 18:00 rij
const CELL_HEIGHT = 28; // px per hour cell

const WORKFLOW_STEPS = [
  { label: 'Aanvraag analyseren', duration: 1200 },
  { label: 'Beschikbaarheid checken', duration: 1500 },
  { label: 'Planningsregels toepassen', duration: 1000 },
  { label: 'Voorstel samenstellen', duration: 800 },
];

// Werktype colors - match de planner kleuren
const WERKTYPE_COLORS: Record<string, string> = {
  'concept': 'bg-task-concept',
  'uitwerking': 'bg-task-uitwerking',
  'productie': 'bg-task-productie',
  'extern': 'bg-task-extern', // Roze/paars voor meetings/presentaties
  'review': 'bg-task-review',
};

const FASE_COLORS: Record<string, string> = {
  'Conceptontwikkeling': 'bg-task-concept',
  'Conceptuitwerking': 'bg-task-uitwerking',
  'Meeting met klant': 'bg-task-extern',
  'Presentatie': 'bg-task-extern',
  'Productie': 'bg-task-productie',
  'Interne review': 'bg-task-review',
  'Algemeen': 'bg-task-concept',
};

export default function EllenVoorstel() {
  const navigate = useNavigate();
  const location = useLocation();

  // Support both projectInfo (from NieuwProject) and formData (from Meeting/Verlof)
  const requestType = location.state?.requestType;
  const rawProjectInfo = location.state?.projectInfo;
  const formData = location.state?.formData;

  // Convert meeting formData to projectInfo format if needed
  const projectInfo = rawProjectInfo || (formData ? {
    type: requestType || 'meeting',
    onderwerp: formData.onderwerp,
    klant_naam: formData.geenProject ? 'Intern' : formData.projectTitel,
    datum: formData.datum,
    starttijd: formData.starttijd,
    eindtijd: formData.eindtijd,
    locatie: formData.locatie,
    medewerkers: formData.medewerkers,
    meetingType: formData.meetingType,
    geenProject: formData.geenProject,
    fases: [{
      fase_naam: formData.onderwerp || 'Meeting',
      medewerkers: formData.medewerkers || [],
      start_datum: formData.datum,
      eind_datum: formData.datum,
    }],
  } : null);

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
  const [laatsteFeedback, setLaatsteFeedback] = useState<string>('');
  const [ellenUitleg, setEllenUitleg] = useState<string>('');
  const [workingTooLong, setWorkingTooLong] = useState(false);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [retryCount, setRetryCount] = useState(0); // used in generateVoorstel deps
  const voorstelGenerated = useRef(false);

  // Timeout timer voor als Ellen te lang duurt
  useEffect(() => {
    if (flowState !== 'ellen-working') {
      setWorkingTooLong(false);
      setSecondsElapsed(0);
      return;
    }

    const interval = setInterval(() => {
      setSecondsElapsed(prev => {
        const newVal = prev + 1;
        if (newVal >= 30) setWorkingTooLong(true);
        return newVal;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [flowState]);

  // Retry functie - reset state en probeer opnieuw
  const retryGeneration = () => {
    voorstelGenerated.current = false;
    setFlowState('ellen-working');
    setWorkingTooLong(false);
    setSecondsElapsed(0);
    setActiveStep(0);
    setCompletedSteps([]);
    setErrorMessage('');
    setRetryCount(prev => prev + 1);
  };

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
      // Prevent double execution (React StrictMode / re-renders)
      if (voorstelGenerated.current) return;
      voorstelGenerated.current = true;

      const sessionToken = getSessionToken();
      if (!sessionToken) {
        setFlowState('error');
        setErrorMessage('Je bent niet ingelogd.');
        return;
      }

      try {
        // Collect medewerkers and period for pre-fetching
        const alleMedewerkers: string[] = [];

        // Handle both project fases and meeting medewerkers
        if (projectInfo.fases?.length > 0) {
          projectInfo.fases.forEach((f: any) => {
            f.medewerkers?.forEach((m: string) => {
              if (!alleMedewerkers.includes(m)) alleMedewerkers.push(m);
            });
          });
        } else if (projectInfo.medewerkers?.length > 0) {
          // Direct medewerkers array (from meeting form)
          projectInfo.medewerkers.forEach((m: string) => {
            if (!alleMedewerkers.includes(m)) alleMedewerkers.push(m);
          });
        }

        const startDatum = projectInfo.datum || projectInfo.fases?.[0]?.start_datum || new Date().toISOString().split('T')[0];

        // Build appropriate prompt based on request type
        const isMeeting = projectInfo.type === 'meeting' || projectInfo.meetingType;
        const prompt = isMeeting ? buildMeetingPrompt(projectInfo) : buildEllenPrompt(projectInfo);

        // Bouw directe planfases van formulierdata (bypast Claude voor workload)
        const directPlanFases = isMeeting ? null : buildDirectPlanFases(projectInfo);

        const invokePromise = supabase.functions.invoke('ellen-chat', {
          headers: { Authorization: `Bearer ${sessionToken}` },
          body: {
            sessie_id: `${isMeeting ? 'meeting' : 'project'}-${Date.now()}`,
            bericht: prompt,
            project_data: {
              medewerkers: alleMedewerkers,
              klant_naam: projectInfo.klant_naam || (projectInfo.geenProject ? 'Intern' : 'Onbekend'),
              project_naam: projectInfo.projectnaam || projectInfo.klant_naam || 'Project',
              start_datum: toISODate(startDatum) || startDatum,
              eind_datum: toISODate(projectInfo.deadline || projectInfo.datum),
              direct_plan_fases: directPlanFases, // null = gebruik Claude, array = skip Claude
            },
          },
        });

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Ellen timeout na 28 seconden')), 28000)
        );

        const result = await Promise.race([invokePromise, timeoutPromise]);
        const { data, error } = result as { data: any; error: any };

        if (error) {
          // Check for rate limit
          const errorMsg = error.message || '';
          if (errorMsg.includes('429') || data?.code === 'RATE_LIMITED') {
            toast({
              title: 'Even geduld',
              description: 'AI is tijdelijk overbelast. Probeer het over 30 seconden opnieuw.',
              variant: 'destructive',
            });
          }
          throw new Error(errorMsg);
        }

        if (data?.voorstel?.type === 'planning_voorstel' && data.voorstel.taken?.length > 0) {
          // Pre-genereer presentatietaken met exacte datum/tijd uit het formulier
          const presentatieTaken = buildPresentatieTaken(projectInfo);
          // Verwijder alleen de Ellen-taken waarvan de fase_naam exact overeenkomt
          // met een van de pre-gebouwde presentatiefasen — niet alles met "presentatie" erin
          const presentatieFaseNamen = new Set(
            presentatieTaken.map(t => (t.fase_naam || '').toLowerCase())
          );
          const ellenTakenZonderPresentaties = presentatieTaken.length > 0
            ? data.voorstel.taken.filter((t: any) =>
                !presentatieFaseNamen.has((t.fase_naam || '').toLowerCase())
              )
            : data.voorstel.taken;
          setVoorstellen([...ellenTakenZonderPresentaties, ...presentatieTaken]);
          setEllenUitleg(cleanEllenText(data?.antwoord || ''));
          setEllenMessage('');
          setFlowState('voorstel');
        } else {
          // Ellen gaf geen voorstel terug — toon foutmelding, geen stille fallback
          const reden = data?.antwoord ? `Ellen zei: "${cleanEllenText(data.antwoord)}"` : 'Ellen heeft geen voorstel teruggestuurd.';
          setErrorMessage(`Er is geen planning gemaakt. ${reden}\n\nProbeer opnieuw of ga terug naar het formulier.`);
          setFlowState('error');
        }
      } catch (err: any) {
        console.error('Ellen voorstel error:', err);
        const isTimeout = err?.message?.includes('timeout') || err?.message?.includes('28 seconden');
        const isRateLimit = err?.message?.includes('429') || err?.message?.includes('overbelast');
        if (isTimeout) {
          setErrorMessage('Ellen heeft te lang nodig gehad (timeout). Er zijn geen tokens verbruikt voor dit verzoek.\n\nProbeer opnieuw — bij een nieuw project met minder medewerkers gaat het sneller.');
        } else if (isRateLimit) {
          setErrorMessage('De AI is tijdelijk overbelast. Probeer het over 30 seconden opnieuw.');
        } else {
          setErrorMessage(`Er ging iets mis: ${err?.message || 'Onbekende fout'}.\n\nProbeer opnieuw of ga terug naar het formulier.`);
        }
        setFlowState('error');
      }
    };

    // Wait for all workflow steps to complete visually before showing the voorstel
    const totalWorkflowDuration = WORKFLOW_STEPS.reduce((sum, s) => sum + s.duration + 200, 0) + 500;
    const timer = setTimeout(generateVoorstel, totalWorkflowDuration);
    return () => clearTimeout(timer);
  }, [projectInfo, retryCount]);

  const handleApprove = () => {
    setFlowState('color-select');
  };

  const handleColorSelected = () => {
    setFlowState('client-check');
  };

  const handleClientApprovalNeeded = async (needsClientApproval: boolean) => {
    setFlowState('placing');
    try {
      const sessionToken = getSessionToken();
      if (!sessionToken) throw new Error('Niet ingelogd');

      const planStatus = needsClientApproval ? 'wacht_klant' : 'vast';
      const werktype = selectedWerktype;
      const werktypeLabels: Record<string, string> = {
        concept: 'Conceptontwikkeling',
        uitwerking: 'Conceptuitwerking',
        productie: 'Productie',
        extern: 'Meeting met klant',
        review: 'Interne review',
      };
      const faseLabel = werktypeLabels[werktype] || werktype;
      // Use volledigProjectId from form if available, otherwise generate
      const projectNummer = formData?.projectHeader?.volledigProjectId || `P-${Date.now().toString().slice(-6)}`;

      // 1. Zoek klant
      const { data: klanten } = await secureSelect<{ id: string }>('klanten', {
        columns: 'id',
        filters: [{ column: 'naam', operator: 'ilike', value: `%${projectInfo.klant_naam}%` }],
        limit: 1,
      });
      const klantId = klanten?.[0]?.id;
      if (!klantId) throw new Error(`Klant "${projectInfo.klant_naam}" niet gevonden`);

      // 2. Maak project aan
      const { data: projectResult, error: projectErr } = await secureInsert<{ id: string; projectnummer: string }>('projecten', {
        klant_id: klantId,
        projectnummer: projectNummer,
        omschrijving: projectInfo.projectnaam || projectInfo.klant_naam,
        projecttype: projectInfo.projecttype || 'algemeen',
        deadline: projectInfo.deadline,
        status: 'concept',
        datum_aanvraag: new Date().toISOString().split('T')[0],
        volgnummer: Date.now() % 10000,
      });
      if (projectErr) throw new Error(`Kon project niet aanmaken: ${projectErr.message}`);
      const project = Array.isArray(projectResult) ? projectResult[0] : projectResult;
      if (!project?.id) throw new Error('Project aangemaakt maar geen ID terug gekregen');

      // 3. Maak taken aan - één voor één
      // Detecteer presentaties vs werkzaamheden voor juiste kleuren
      const presentatieNamen = projectInfo.fases
        ?.filter((f: any) => f.type === 'presentatie')
        ?.map((f: any) => f.fase_naam?.toLowerCase()) || [];

      let aantalGeplaatst = 0;
      const fouten: string[] = [];
      for (const taak of voorstellen) {
        // Check of dit een presentatie is (match op fase_naam)
        const isPresentatie = presentatieNamen.some((pn: string) =>
          taak.fase_naam?.toLowerCase().includes(pn) ||
          pn?.includes(taak.fase_naam?.toLowerCase() || '')
        ) || taak.fase_naam?.toLowerCase().includes('presentatie') ||
           taak.fase_naam?.toLowerCase().includes('meeting');

        // Bepaal werktype: presentaties krijgen 'extern', werkzaamheden de geselecteerde kleur
        const taakWerktype = isPresentatie ? 'extern' : werktype;
        const taakFaseLabel = isPresentatie ? 'Meeting met klant' : faseLabel;

        const { error: taakErr } = await secureInsert('taken', {
          project_id: project.id,
          werknemer_naam: taak.werknemer_naam,
          klant_naam: projectInfo.klant_naam,
          project_nummer: projectNummer,
          fase_naam: taak.fase_naam || taakFaseLabel,
          werktype: taakWerktype,
          discipline: isPresentatie ? 'Meeting' : 'Algemeen',
          week_start: taak.week_start,
          dag_van_week: taak.dag_van_week,
          start_uur: taak.start_uur,
          duur_uren: taak.duur_uren,
          plan_status: planStatus,
          is_hard_lock: isPresentatie, // Presentaties met vaste datum zijn hard locks
        });
        if (taakErr) {
          console.error('Taak insert fout:', taakErr.message);
          fouten.push(`${taak.werknemer_naam}: ${taakErr.message}`);
        } else {
          aantalGeplaatst++;
        }
      }

      if (aantalGeplaatst === 0) {
        throw new Error(`Geen taken geplaatst. Fouten: ${fouten.join('; ')}`);
      }

      // Sla de aanvraag op met juiste status
      saveAanvraag({
        id: `project-${Date.now()}`,
        type: 'nieuw-project',
        status: needsClientApproval ? 'wacht_klant' : 'geplaatst',
        titel: projectInfo?.projectnaam || projectInfo?.klant_naam || 'Project',
        klant: projectInfo?.klant_naam,
        datum: new Date().toISOString(),
        projectType: projectInfo?.projecttype,
      });

      toast({
        title: `${aantalGeplaatst} taken geplaatst`,
        description: needsClientApproval
          ? 'De planning staat als concept in de planner (doorzichtig).'
          : `Planning "${projectNummer}" is vastgezet in de planner.`,
      });
      setFlowState('done');
    } catch (err) {
      console.error('Planning opslaan fout:', err);
      const errorMsg = err instanceof Error ? err.message : 'Er ging iets mis bij het aanmaken';

      // Sla de mislukte aanvraag op zodat de gebruiker het kan herproberen
      saveAanvraag({
        id: `project-mislukt-${Date.now()}`,
        type: 'nieuw-project',
        status: 'mislukt',
        titel: projectInfo?.projectnaam || projectInfo?.klant_naam || 'Project',
        klant: projectInfo?.klant_naam,
        datum: new Date().toISOString(),
        projectType: projectInfo?.projecttype,
        errorMessage: errorMsg,
        projectInfo: projectInfo,
      });

      setFlowState('error');
      setErrorMessage(errorMsg);
    }
  };

  const handleReject = () => {
    navigate('/nieuw-project');
  };

  const handleRequestNewProposal = async () => {
    if (!feedbackInput.trim()) return;

    setIsRequestingNewProposal(true);
    setEllenMessage('Even kijken, ik pas het voorstel aan...');
    const gegevenFeedback = feedbackInput.trim();

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
            feedback: gegevenFeedback,
            context: {
              project_info: projectInfo,
              vorig_voorstel: voorstellen,
            },
          },
        });
      } catch {
        console.warn('Feedback opslaan mislukt, ga door met nieuw voorstel');
      }

      const alleMw: string[] = [];
      projectInfo.fases?.forEach((f: any) => {
        f.medewerkers?.forEach((m: string) => {
          if (!alleMw.includes(m)) alleMw.push(m);
        });
      });

      const { data, error } = await supabase.functions.invoke('ellen-chat', {
        headers: { Authorization: `Bearer ${sessionToken}` },
        body: {
          sessie_id: `project-${Date.now()}`,
          bericht: buildEllenPrompt(projectInfo, gegevenFeedback, voorstellen),
          project_data: {
            medewerkers: alleMw,
            klant_naam: projectInfo.klant_naam,
            start_datum: projectInfo.fases?.[0]?.start_datum || new Date().toISOString().split('T')[0],
            eind_datum: projectInfo.deadline,
          },
        },
      });

      if (error) throw new Error(error.message);

      if (data?.voorstel?.type === 'planning_voorstel' && data.voorstel.taken?.length > 0) {
        setVoorstellen(data.voorstel.taken);
        setLaatsteFeedback(gegevenFeedback);
        setEllenUitleg(cleanEllenText(data?.antwoord || ''));
        setEllenMessage('');
      } else if (data?.antwoord) {
        // Fallback - Ellen heeft geen tool gebruikt, maar probeer haar antwoord te tonen
        console.warn('Geen planning_voorstel ontvangen bij feedback, gebruik vorig voorstel als basis');
        setLaatsteFeedback(gegevenFeedback);
        setEllenUitleg(cleanEllenText(data.antwoord));
        // Behoud het huidige voorstel zodat de gebruiker het opnieuw kan proberen
        setEllenMessage('Ellen kon geen nieuw voorstel genereren. Probeer het opnieuw met andere feedback.');
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

  const getFaseColor = (faseNaam: string, werktype?: string) => {
    // Eerst werktype checken (meest betrouwbaar)
    if (werktype && WERKTYPE_COLORS[werktype]) {
      return WERKTYPE_COLORS[werktype];
    }
    // Fallback naar fase naam
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

            {/* Timeout warning en acties */}
            {workingTooLong && (
              <Card className="p-4 bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800">
                <div className="flex items-start gap-3">
                  <div className="text-amber-600 dark:text-amber-400 text-lg">⚠️</div>
                  <div className="space-y-2 flex-1">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      Dit duurt langer dan verwacht ({secondsElapsed}s)
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      Ellen is mogelijk overbelast. Je kunt opnieuw proberen of teruggaan.
                    </p>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" variant="outline" onClick={() => navigate('/nieuw-project')}>
                        Terug
                      </Button>
                      <Button size="sm" onClick={retryGeneration}>
                        Opnieuw proberen
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Altijd een annuleren optie */}
            {!workingTooLong && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => navigate('/nieuw-project')}
              >
                Annuleren
              </Button>
            )}
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
                  {laatsteFeedback ? 'Ik heb je feedback verwerkt. Hier is het aangepaste voorstel:' : 'Hier is mijn voorstel voor de planning:'}
                </p>
              </div>
            </div>

            {/* Ellen toelichting - altijd tonen als beschikbaar */}
            {(ellenUitleg || laatsteFeedback) && (
              <Card className="p-4 bg-muted/50 border-border">
                <div className="space-y-2">
                  {laatsteFeedback && (
                    <p className="text-xs font-medium text-muted-foreground">
                      Jouw feedback: <span className="italic text-foreground">"{laatsteFeedback}"</span>
                    </p>
                  )}
                  {ellenUitleg && (
                    <p className="text-sm text-foreground">
                      {ellenUitleg}
                    </p>
                  )}
                </div>
              </Card>
            )}

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
                                        getFaseColor(taak.fase_naam, taak.werktype)
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
              <Button onClick={() => navigate('/?tab=planner')}>
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
              <Button variant="outline" onClick={() => navigate('/nieuw-project')}>
                Terug naar formulier
              </Button>
              <Button onClick={retryGeneration}>
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
 * Bouw Ellen prompt voor standalone meetings (zonder project)
 */
function buildMeetingPrompt(info: any): string {
  const parts: string[] = [];

  parts.push(`=== MEETING PLANNING AANVRAAG ===`);
  parts.push(``);
  parts.push(`Type aanvraag: Meeting / Presentatie`);
  parts.push(``);

  parts.push(`--- MEETING DETAILS ---`);
  parts.push(`Onderwerp: ${info.onderwerp || 'Niet opgegeven'}`);
  parts.push(`Type meeting: ${info.meetingType || 'Algemeen'}`);
  parts.push(`Gekoppeld aan project: ${info.geenProject ? 'Nee (standalone meeting)' : info.klant_naam || 'Onbekend'}`);
  parts.push(``);

  parts.push(`--- DATUM & TIJD ---`);
  parts.push(`Gewenste datum: ${info.datum || 'Niet opgegeven'}`);
  parts.push(`Gewenste starttijd: ${info.starttijd || 'Niet opgegeven'}`);
  parts.push(`Gewenste eindtijd: ${info.eindtijd || 'Niet opgegeven'}`);
  parts.push(`Locatie: ${info.locatie || 'Niet opgegeven'}`);
  parts.push(``);

  parts.push(`--- DEELNEMERS ---`);
  if (info.medewerkers?.length > 0) {
    parts.push(`Geselecteerde deelnemers: ${info.medewerkers.join(', ')}`);
  } else {
    parts.push(`Geen deelnemers geselecteerd - dit is een probleem!`);
  }
  parts.push(``);

  parts.push(`--- INSTRUCTIE ---`);
  parts.push(`Plan deze meeting in met de opgegeven details.`);
  parts.push(`Check de beschikbaarheid van alle deelnemers op de gewenste datum en tijd.`);
  parts.push(`Als de gewenste tijd niet beschikbaar is, stel alternatieve tijden voor.`);

  return parts.join('\n');
}

/**
 * Bouw Ellen prompt - Volledige context voor slimme planning
 */
/**
 * Pre-genereer presentatietaken voor presentaties met een exacte datum/tijd.
 * Deze worden direct vanuit het formulier aangemaakt — Ellen hoeft ze niet te plannen.
 */
/** Converteer dd-MM-yyyy of YYYY-MM-DD naar YYYY-MM-DD */
function toISODate(dateStr: string | undefined): string | undefined {
  if (!dateStr) return undefined;
  const p = parseDatumParts(dateStr);
  if (!p) return dateStr;
  return `${p.year}-${String(p.month + 1).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/**
 * Bouw plan_project fases direct van formulierdata — bypast Claude-beslissing.
 * Per medewerker een aparte fase zodat uren exact kloppen.
 */
function buildDirectPlanFases(info: any): Array<any> | null {
  const werkzaamheden = (info.fases || []).filter((f: any) => f.type !== 'presentatie');
  if (!werkzaamheden.length) return null;

  const planFases: Array<any> = [];
  const presentaties = (info.fases || []).filter((f: any) => f.type === 'presentatie');

  werkzaamheden.forEach((f: any) => {
    // Zoek bijbehorende presentatiedeadline
    const faseNaamLower = (f.fase_naam || '').toLowerCase().replace('werkzaamheden - ', '');
    const bijhorendePresentatie = presentaties.find((p: any) =>
      (p.fase_naam || '').toLowerCase().includes(faseNaamLower) ||
      faseNaamLower.includes((p.fase_naam || '').toLowerCase())
    );
    const deadline = bijhorendePresentatie?.datumType === 'zelf' && bijhorendePresentatie?.start_datum
      ? toISODate(bijhorendePresentatie.start_datum)
      : toISODate(info.deadline);

    const startDatum = toISODate(f.start_datum) || toISODate(info.fases?.[0]?.start_datum) || new Date().toISOString().split('T')[0];

    if (f.medewerkerDetails?.length > 0) {
      f.medewerkerDetails.forEach((md: any) => {
        if (!md.naam) return;
        const totaalUren = md.uren || 0;
        const urenPerDag = totaalUren > 0 ? Math.min(8, totaalUren) : (f.uren_per_dag || 4);
        const duurDagen = totaalUren > 0 ? Math.ceil(totaalUren / urenPerDag) : (f.duur_dagen || 1);
        planFases.push({
          fase_naam: f.fase_naam,
          medewerkers: [md.naam],
          start_datum: startDatum,
          duur_dagen: Math.max(1, duurDagen),
          uren_per_dag: urenPerDag,
          verdeling: 'aaneengesloten',
          _deadline: deadline, // voor context, niet in tool schema
        });
      });
    } else if (f.medewerkers?.length > 0) {
      planFases.push({
        fase_naam: f.fase_naam,
        medewerkers: f.medewerkers,
        start_datum: startDatum,
        duur_dagen: Math.max(1, f.duur_dagen || 1),
        uren_per_dag: f.uren_per_dag || 8,
        verdeling: 'aaneengesloten',
        _deadline: deadline,
      });
    }
  });

  return planFases.length > 0 ? planFases : null;
}

/** Parse datum string in dd-MM-yyyy of YYYY-MM-DD formaat naar losse year/month/day */
function parseDatumParts(datumStr: string): { year: number; month: number; day: number } | null {
  if (!datumStr) return null;
  const parts = datumStr.split('-');
  if (parts.length !== 3) return null;
  // dd-MM-yyyy: eerste deel is 2 cijfers en <= 31
  if (parts[0].length === 2) {
    return { day: parseInt(parts[0], 10), month: parseInt(parts[1], 10) - 1, year: parseInt(parts[2], 10) };
  }
  // YYYY-MM-DD
  return { year: parseInt(parts[0], 10), month: parseInt(parts[1], 10) - 1, day: parseInt(parts[2], 10) };
}

/**
 * Pre-genereer presentatietaken voor presentaties met een exacte datum/tijd.
 * Deze worden direct vanuit het formulier aangemaakt — Ellen hoeft ze niet te plannen.
 */
function buildPresentatieTaken(info: any): VoorstelTaak[] {
  const taken: VoorstelTaak[] = [];
  const presentaties = info.fases?.filter((f: any) => f.type === 'presentatie') || [];

  for (const p of presentaties) {
    if (p.datumType !== 'zelf' || !p.start_datum) continue;

    const parsed = parseDatumParts(p.start_datum);
    if (!parsed) continue;

    // Maak datum zonder timezone issues
    const datum = new Date(parsed.year, parsed.month, parsed.day);
    const dagOfWeek = datum.getDay(); // 0=zo, 6=za
    if (dagOfWeek === 0 || dagOfWeek === 6) continue;

    // week_start = maandag van die week (YYYY-MM-DD)
    const maandag = new Date(datum);
    maandag.setDate(datum.getDate() + (1 - dagOfWeek));
    const weekStart = `${maandag.getFullYear()}-${String(maandag.getMonth() + 1).padStart(2, '0')}-${String(maandag.getDate()).padStart(2, '0')}`;
    const dagVanWeek = dagOfWeek - 1; // 0=ma, 4=vr

    // startuur uit tijd (bijv. "14:00" → 14)
    let startUur = 10;
    if (p.tijd) {
      const tijdParts = (p.tijd as string).split(':');
      startUur = parseInt(tijdParts[0], 10) || 10;
    }
    const duurUren = p.uren_per_dag || 2;

    for (const medewerker of (p.medewerkers || [])) {
      if (!medewerker) continue;
      taken.push({
        werknemer_naam: medewerker,
        fase_naam: p.fase_naam || 'Presentatie',
        dag_van_week: dagVanWeek,
        week_start: weekStart,
        start_uur: startUur,
        duur_uren: duurUren,
        werktype: 'extern',
      });
    }
  }

  return taken;
}

function buildEllenPrompt(info: any, feedback?: string, vorigVoorstel?: VoorstelTaak[]): string {
  const parts: string[] = [];

  // Header met duidelijke opdracht
  parts.push(`=== PROJECT PLANNING AANVRAAG ===`);
  parts.push(``);
  parts.push(`LEES ALLE INFORMATIE HIERONDER ZORGVULDIG:`);
  parts.push(``);

  // Project details
  parts.push(`--- PROJECT DETAILS ---`);
  parts.push(`Klant: ${info.klant_naam}`);
  parts.push(`Project titel: ${info.projectTitel || 'Niet opgegeven'}`);
  parts.push(`Project omschrijving: ${info.projectnaam || 'Niet opgegeven'}`);
  parts.push(`Type: ${info.projecttype || 'algemeen'}`);
  parts.push(`Intern project: ${info.isInternProject ? 'Ja' : 'Nee'}`);
  parts.push(``);

  // Datum en deadline - EXPLICIET
  parts.push(`--- DATUM & DEADLINE ---`);
  const startDatumVanFases = info.fases?.[0]?.start_datum;
  parts.push(`Startdatum: ${startDatumVanFases || 'Niet opgegeven - bepaal zelf een geschikte start'}`);
  parts.push(`Deadline: ${info.deadline || 'NIET OPGEGEVEN - vraag om verduidelijking of plan conservatief'}`);
  if (info.deadline) {
    const deadlineDate = new Date(info.deadline);
    const today = new Date();
    const diffDays = Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    parts.push(`Dagen tot deadline: ${diffDays} dagen`);
  }

  // Fases en presentaties - apart behandelen
  const werkzaamheden = info.fases?.filter((f: any) => f.type !== 'presentatie') || [];
  const presentaties = info.fases?.filter((f: any) => f.type === 'presentatie') || [];

  // WERKFLOW: Presentaties zijn milestones, workload is het werk NAAR die presentatie toe
  parts.push(``);
  parts.push(`=== PRESENTATIES & WERKZAAMHEDEN ===`);
  parts.push(``);
  parts.push(`⚠️ KRITIEK: Dit project heeft ${presentaties.length} presentatie(s).`);
  parts.push(`Elke presentatie heeft een WORKLOAD die VOOR de presentatie moet worden afgerond.`);
  parts.push(``);

  // Loop door presentaties en hun bijbehorende werkzaamheden
  presentaties.forEach((p: any, i: number) => {
    // Zoek de werkzaamheden die bij deze presentatie horen
    const werkVoorPresentatie = werkzaamheden.find((w: any) =>
      w.fase_naam?.toLowerCase().includes(p.fase_naam?.toLowerCase()) ||
      w.fase_naam?.toLowerCase().includes('werkzaamheden')
    );

    parts.push(`--- PRESENTATIE ${i + 1}: "${p.fase_naam}" ---`);

    // Presentatie details
    if (p.datumType === 'zelf' && p.start_datum) {
      parts.push(`📅 EXACTE DATUM: ${p.start_datum}${p.tijd ? ` om ${p.tijd}` : ''}`);
      parts.push(`🔒 PRESENTATIE IS AL INGEPLAND OP DEZE DATUM — jij hoeft deze NIET meer te plannen.`);
      parts.push(`   Jouw taak: plan ALLEEN de workload hieronder, die moet klaar zijn VÓÓR ${p.start_datum}.`);
    } else {
      parts.push(`📅 Datum: kies zelf een datum vóór de deadline: ${info.deadline || 'niet opgegeven'}`);
    }
    parts.push(`👥 Aanwezig bij presentatie: ${p.medewerkers?.join(', ') || 'Team'}`);
    parts.push(`📍 Locatie: ${p.locatie === 'klant' ? 'Bij klant' : p.locatie === 'selmore' ? 'Bij Selmore' : 'Nog niet bepaald'}`);
    parts.push(`⏱️ Duur presentatie: ${p.uren_per_dag || 2} uur`);
    parts.push(``);

    // Werkzaamheden voor deze presentatie
    if (werkVoorPresentatie) {
      const deadlineWerk = p.datumType === 'zelf' && p.start_datum ? p.start_datum : info.deadline;
      const startWerk = werkVoorPresentatie.start_datum || info.fases?.[0]?.start_datum;
      parts.push(`WORKLOAD VOOR DEZE PRESENTATIE:`);
      parts.push(`🚨 HARDE DEADLINE: Dit werk moet KLAAR zijn VÓÓR ${deadlineWerk}!`);
      if (startWerk) parts.push(`📅 Startdatum werkzaamheden: ${startWerk}`);
      parts.push(`📅 Einddatum werkzaamheden: uiterlijk ${deadlineWerk} (dag VÓÓR de presentatie)`);
      if (werkVoorPresentatie.medewerkerDetails?.length > 0) {
        werkVoorPresentatie.medewerkerDetails.forEach((md: any) => {
          const totaalUren = md.uren || 0;
          if (totaalUren > 0) {
            parts.push(`  • ${md.naam}: ${totaalUren} uur totaal (verdeel over ${werkVoorPresentatie.duur_dagen || 1} dag(en) vanaf ${startWerk || 'zo snel mogelijk'})`);
          } else {
            // Bereken default op basis van duur_dagen
            const defaultUren = (werkVoorPresentatie.duur_dagen || 1) * (werkVoorPresentatie.uren_per_dag || 4);
            parts.push(`  • ${md.naam}: ca. ${defaultUren} uur (${werkVoorPresentatie.duur_dagen || 1} dag × ${werkVoorPresentatie.uren_per_dag || 4}u) — plan dit in`);
          }
        });
      } else {
        parts.push(`  Medewerkers: ${werkVoorPresentatie.medewerkers?.join(', ') || 'Geen opgegeven'}`);
        parts.push(`  Duur: ${werkVoorPresentatie.duur_dagen} dag(en), ${werkVoorPresentatie.uren_per_dag || 8}u/dag`);
      }
    }
    parts.push(``);
  });

  // Als er geen presentaties zijn maar wel werkzaamheden
  if (presentaties.length === 0 && werkzaamheden.length > 0) {
    parts.push(`--- WERKZAAMHEDEN ---`);
    werkzaamheden.forEach((f: any) => {
      parts.push(`"${f.fase_naam}"`);
      if (f.start_datum) parts.push(`  📅 Startdatum: ${f.start_datum}`);
      parts.push(`  📅 Deadline: ${info.deadline || 'niet opgegeven'}`);
      parts.push(`  👥 Medewerkers: ${f.medewerkers?.join(', ') || 'Geen'}`);
      parts.push(`  ⏱️ Duur: ${f.duur_dagen} dag(en), ${f.uren_per_dag || 8}u/dag`);
      if (f.medewerkerDetails?.length > 0) {
        f.medewerkerDetails.forEach((md: any) => {
          const totaalUren = md.uren || 0;
          if (totaalUren > 0) {
            parts.push(`    • ${md.naam}: ${totaalUren} uur totaal (verdeel over ${f.duur_dagen || 1} dag(en))`);
          } else {
            const defaultUren = (f.duur_dagen || 1) * (f.uren_per_dag || 4);
            parts.push(`    • ${md.naam}: ca. ${defaultUren} uur (${f.duur_dagen || 1} dag × ${f.uren_per_dag || 4}u) — plan dit in`);
          }
        });
      }
      parts.push(``);
    });
  }

  if (presentaties.length === 0 && werkzaamheden.length === 0) {
    parts.push(`Geen specifieke fases opgegeven`);
    parts.push(``);
  }

  // Legacy meetings support (oude structuur)
  if (info.meetings?.length > 0) {
    parts.push(`--- EXTRA MEETINGS ---`);
    info.meetings.forEach((m: any) => {
      const typeLabels: Record<string, string> = {
        'kick-off': 'Kick-off meeting',
        'tussentijds': 'Tussentijdse presentatie',
        'eindpresentatie': 'Eindpresentatie',
        'anders': 'Overige meeting',
      };
      parts.push(`- ${typeLabels[m.type] || m.type}: ${m.aantalUren} uur${m.notitie ? ` - "${m.notitie}"` : ''}`);
    });
    parts.push(``);
  }

  // Betrokken personen
  parts.push(``);
  parts.push(`--- OVERIGE BETROKKENEN ---`);
  if (info.betrokkenPersonen?.length > 0) {
    parts.push(`${info.betrokkenPersonen.join(', ')}`);
  } else {
    parts.push(`Geen overige betrokkenen opgegeven`);
  }

  // Feedback van planner
  if (feedback) {
    parts.push(``);
    parts.push(`--- FEEDBACK OP VORIG VOORSTEL ---`);
    parts.push(`De planner heeft het volgende voorstel AFGEKEURD met deze feedback:`);
    parts.push(`"${feedback}"`);
    parts.push(``);
    parts.push(`VORIG VOORSTEL (dat werd afgekeurd):`);
    if (vorigVoorstel?.length) {
      const perMw: Record<string, Array<{ dag: number; week: string; uur: number; duur: number; fase: string }>> = {};
      vorigVoorstel.forEach((t: VoorstelTaak) => {
        if (!perMw[t.werknemer_naam]) perMw[t.werknemer_naam] = [];
        perMw[t.werknemer_naam].push({
          dag: t.dag_van_week,
          week: t.week_start,
          uur: t.start_uur,
          duur: t.duur_uren,
          fase: t.fase_naam,
        });
      });
      Object.entries(perMw).forEach(([naam, taken]) => {
        parts.push(`  ${naam}: ${taken.length} blokken`);
        taken.forEach(t => {
          const dagNamen = ['ma', 'di', 'wo', 'do', 'vr'];
          parts.push(`    - ${dagNamen[t.dag] || t.dag} (week ${t.week}): ${t.uur}:00-${t.uur + t.duur}:00 → ${t.fase}`);
        });
      });
    }
    parts.push(``);
    parts.push(`BELANGRIJK: Gebruik plan_project tool om een NIEUW voorstel te maken dat de feedback verwerkt.`);
    parts.push(`Pas ALLEEN aan wat de planner vraagt. Behoud de rest van het voorstel.`);
  }

  // Verzamel alle medewerkers voor de beschikbaarheidscheck
  const alleMedewerkers = new Set<string>();
  info.fases?.forEach((f: any) => {
    f.medewerkers?.forEach((m: string) => alleMedewerkers.add(m));
  });
  const medewerkersList = Array.from(alleMedewerkers).join(', ');

  // Bepaal periode
  const startDatum = info.fases?.[0]?.start_datum || 'vandaag';
  const deadline = info.deadline || 'niet opgegeven';

  // Expliciete instructies voor Ellen - COMPLETE WORKFLOW
  parts.push(``);
  parts.push(`=== VOLLEDIGE WORKFLOW - VOLG DEZE STAPPEN ===`);
  parts.push(``);
  parts.push(`STAP 1: BEKIJK HUIDIGE PLANNING`);
  parts.push(`Gebruik zoek_taken tool om te zien wat er AL ingepland staat:`);
  parts.push(`- Voor elke medewerker: ${medewerkersList || 'alle medewerkers'}`);
  parts.push(`- Periode: ${startDatum} tot ${deadline}`);
  parts.push(`Analyseer:`);
  parts.push(`- Welke projecten staan er al? Wat zijn hun deadlines?`);
  parts.push(`- Hoeveel uren zijn al bezet per dag/week?`);
  parts.push(`- Zijn er conflicten met dit nieuwe project?`);
  parts.push(``);
  parts.push(`STAP 2: CHECK BESCHIKBAARHEID`);
  parts.push(`Gebruik check_beschikbaarheid tool voor: ${medewerkersList || 'alle medewerkers'}`);
  parts.push(`Periode: ${startDatum} tot ${deadline}`);
  parts.push(`Check: verlof, parttime dagen, totaal ingeplande uren`);
  parts.push(`Let op: max 40 uur per week per medewerker!`);
  parts.push(``);
  parts.push(`STAP 3: PRIORITEITEN BEPALEN`);
  parts.push(`Vergelijk dit project met bestaande projecten:`);
  parts.push(`- Dit project deadline: ${deadline}`);
  parts.push(`- Projecten met EERDERE deadline hebben voorrang`);
  parts.push(`- Bij conflict: meld dit en stel alternatief voor`);
  parts.push(``);
  parts.push(`STAP 4: CHECK MICROSOFT AGENDA`);
  parts.push(`[BELANGRIJK: Deze functie is nog niet beschikbaar]`);
  parts.push(`Meld in je voorstel: "Microsoft agenda kon niet gecheckt worden - check handmatig of er meetings zijn"`);
  parts.push(``);
  parts.push(`STAP 5: HAAL KLANT INSTRUCTIES OP`);
  parts.push(`Gebruik zoek_klanten voor "${info.klant_naam}"`);
  parts.push(`Let op: planning_instructies veld bevat klant-specifieke regels`);
  parts.push(``);
  parts.push(`STAP 6: CHECK PLANNING REGELS`);
  parts.push(`Je hebt planning regels in je system prompt (hard/soft/voorkeur)`);
  parts.push(`Noem in je reasoning welke regels je hebt toegepast`);
  parts.push(``);
  parts.push(`STAP 7: ANALYSEER TOELICHTINGEN`);
  parts.push(`Per fase, interpreteer de toelichting:`);
  parts.push(`- "1 dag per week" of "wekelijks" → verdeling: per_week, dagen_per_week: 1`);
  parts.push(`- "2 dagen per week" → verdeling: per_week, dagen_per_week: 2`);
  parts.push(`- "laatste week" of "finishing touches" → verdeling: laatste_week`);
  parts.push(`- "feedback" of "review" → plan op DONDERDAG of VRIJDAG`);
  parts.push(`- Geen specifieke instructie → verdeling: aaneengesloten`);
  parts.push(``);
  parts.push(`STAP 8: MAAK PLANNING`);
  parts.push(`Gebruik plan_project tool met:`);
  parts.push(`- Zet voor ELKE taak een specifiek start_uur (niet altijd 9!)`);
  parts.push(`- Als een medewerker al iets heeft van 9-12, plan dan vanaf 14 (na lunch)`);
  parts.push(`- Korte taken (1-2u) mogen later op de dag (bijv. 14:00 of 15:00)`);
  parts.push(`- Plan rondom bestaande taken (niet overschrijven!)`);
  parts.push(`- Alle medewerkers starten PARALLEL (niet sequentieel)`);
  parts.push(`- Respecteer beschikbaarheid en max 40u/week`);
  parts.push(`- Respecteer klant instructies`);
  parts.push(`- Pas planning regels toe`);
  parts.push(`- Gebruik verdelingen uit stap 7`);
  parts.push(``);
  parts.push(`BELANGRIJK - EXACT vs ONGEVEER:`);
  parts.push(`- Als bij een medewerker "🔒 EXACT" staat: plan PRECIES dat aantal uren/dagen. Geen afwijking toegestaan.`);
  parts.push(`- Als bij een medewerker "⚠️ ONGEVEER" staat: je mag tot ±20% afwijken als dat beter uitkomt qua beschikbaarheid.`);
  parts.push(`- Als er GEEN "ongeveer" info is: behandel het als EXACT.`);
  parts.push(``);
  parts.push(`STAP 9: KORTE TOELICHTING`);
  parts.push(`Geef een kort, menselijk antwoord (max 2-3 zinnen) over wat je hebt gedaan.`);
  parts.push(`Geen opsommingen, geen bullet points. Gewoon een normale zin.`);
  parts.push(`Voorbeeld: "Ik heb Jaimy op maandag en dinsdag ingepland. Woensdag had hij al een ander project."`);
  parts.push(`Bij feedback: leg kort uit wat je hebt aangepast en waarom.`);
  parts.push(`Voorbeeld: "Ik heb Lisa verplaatst naar donderdag zoals gevraagd. De rest blijft hetzelfde."`);
  parts.push(`BELANGRIJK: Schrijf alsof je een collega bent, niet als een AI.`);

  return parts.join('\n');
}

function generateDefaultVoorstel(info: any): VoorstelTaak[] {
  const taken: VoorstelTaak[] = [];
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek;
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + daysUntilMonday);
  // Use local date to avoid timezone shift
  const defaultWeekStart = `${nextMonday.getFullYear()}-${String(nextMonday.getMonth() + 1).padStart(2, '0')}-${String(nextMonday.getDate()).padStart(2, '0')}`;

  if (!info.fases?.length) return taken;

  // Track occupied slots per medewerker per day: { "naam-weekstart-dag": nextFreeHour }
  const bezetteSlotsPerDag: Record<string, number> = {};

  const getNextFreeSlot = (medewerker: string, weekStart: string, dagVanWeek: number, duurUren: number): { startUur: number; weekStart: string; dagVanWeek: number } | null => {
    // Try to find a free slot on this day
    const key = `${medewerker}-${weekStart}-${dagVanWeek}`;
    const nextFree = bezetteSlotsPerDag[key] || 9;

    // Skip lunch hour (13:00-14:00)
    let startUur = nextFree;
    if (startUur < 13 && startUur + duurUren > 13) {
      // Block would span lunch - check if it fits before lunch
      if (13 - startUur >= duurUren) {
        // Fits before lunch
      } else {
        // Start after lunch
        startUur = 14;
      }
    } else if (startUur === 13) {
      startUur = 14;
    }

    // Check if it fits within working hours (max 18:00)
    if (startUur + duurUren <= 18) {
      bezetteSlotsPerDag[key] = startUur + duurUren;
      // Skip over lunch for next free calculation
      if (bezetteSlotsPerDag[key] === 13) bezetteSlotsPerDag[key] = 14;
      return { startUur, weekStart, dagVanWeek };
    }

    return null; // Day is full
  };

  // Calculate week start from fase start_datum or use default
  const getWeekStartForDate = (dateStr: string): string => {
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const getDayOfWeekFromDate = (dateStr: string): number => {
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDay();
    return day === 0 ? 6 : day - 1; // Mon=0, Fri=4
  };

  // Groepeer werkzaamheden met hun presentaties
  const werkzaamheden = info.fases.filter((f: any) => f.type !== 'presentatie');
  const presentaties = info.fases.filter((f: any) => f.type === 'presentatie');

  // Plan presentaties met vaste datum eerst, dan werkzaamheden daarvoor
  // Bouw een lijst van presentaties met hun werkzaamheden
  const presentatieGroepen: Array<{ presentatie: any; werkzaamheden: any }> = [];

  presentaties.forEach((p: any) => {
    // Zoek de werkzaamheden die bij deze presentatie horen
    const bijbehorendWerk = werkzaamheden.find((w: any) =>
      w.fase_naam?.toLowerCase().includes(p.fase_naam?.toLowerCase()) ||
      (w.fase_naam?.toLowerCase().includes('werkzaamheden') && p.fase_naam)
    );
    presentatieGroepen.push({ presentatie: p, werkzaamheden: bijbehorendWerk });
  });

  // Verwerk elke groep: eerst presentatie plannen (als exacte datum), dan werkzaamheden ervoor
  for (const groep of presentatieGroepen) {
    const presentatie = groep.presentatie;
    const werkFase = groep.werkzaamheden;

    // Plan presentatie eerst als die een vaste datum heeft
    if (presentatie.datumType === 'zelf' && presentatie.start_datum) {
      const presentatieWeekStart = getWeekStartForDate(presentatie.start_datum);
      const presentatieDagIndex = getDayOfWeekFromDate(presentatie.start_datum);
      const startUur = presentatie.tijd ? parseInt(presentatie.tijd.split(':')[0]) : 14;
      const medewerkers: string[] = presentatie.medewerkers || [];

      for (const mw of medewerkers.length > 0 ? medewerkers : ['Team']) {
        taken.push({
          werknemer_naam: mw,
          fase_naam: presentatie.fase_naam,
          dag_van_week: presentatieDagIndex,
          week_start: presentatieWeekStart,
          start_uur: startUur,
          duur_uren: presentatie.uren_per_dag || 2,
          werktype: 'extern', // Presentaties zijn altijd extern (roze)
        });
      }

      // Plan werkzaamheden VOOR deze presentatie
      if (werkFase) {
        const presentatieDatum = new Date(presentatie.start_datum + 'T00:00:00');
        const werkMedewerkers: string[] = werkFase.medewerkers || [];
        const urenPerDag = werkFase.uren_per_dag || 8;

        // Bereken startdatum voor werkzaamheden (werk achteruit vanaf presentatie)
        for (const mw of werkMedewerkers) {
          // Zoek specifieke uren voor deze medewerker (nu als totaal uren)
          const mdDetail = werkFase.medewerkerDetails?.find((md: any) => md.naam === mw);
          const totaalUren = mdDetail?.uren
            ? mdDetail.uren
            : (werkFase.duur_dagen || 5) * urenPerDag;

          let restUren = totaalUren;
          // Start planning vanaf de dag VOOR de presentatie
          let werkDatum = new Date(presentatieDatum);
          werkDatum.setDate(werkDatum.getDate() - 1);

          while (restUren > 0) {
            // Skip weekenden
            while (werkDatum.getDay() === 0 || werkDatum.getDay() === 6) {
              werkDatum.setDate(werkDatum.getDate() - 1);
            }

            const werkWeekStart = getWeekStartForDate(werkDatum.toISOString().split('T')[0]);
            const werkDagIndex = getDayOfWeekFromDate(werkDatum.toISOString().split('T')[0]);
            const blokUren = Math.min(restUren, urenPerDag);

            const slot = getNextFreeSlot(mw, werkWeekStart, werkDagIndex, blokUren);
            if (slot) {
              taken.push({
                werknemer_naam: mw,
                fase_naam: werkFase.fase_naam,
                dag_van_week: slot.dagVanWeek,
                week_start: slot.weekStart,
                start_uur: slot.startUur,
                duur_uren: blokUren,
                werktype: 'concept', // Workload is concept werk
              });
              restUren -= blokUren;
            }
            werkDatum.setDate(werkDatum.getDate() - 1);
          }
        }
      }
    }
  }

  // Plan overgebleven fases die niet aan een presentatie gekoppeld zijn
  const gekoppeldeWerk = presentatieGroepen.map(g => g.werkzaamheden).filter(Boolean);
  const losseWerkzaamheden = werkzaamheden.filter(w => !gekoppeldeWerk.includes(w));
  const lossePresentaties = presentaties.filter(p => p.datumType !== 'zelf' || !p.start_datum);

  for (const fase of [...losseWerkzaamheden, ...lossePresentaties]) {
    const medewerkers: string[] = fase.medewerkers || [];
    const dagen = fase.duur_dagen || 1;
    const urenPerDag = fase.uren_per_dag || 8;
    const faseStartDatum = fase.start_datum;

    // PRESENTATIES met vaste datum: plaats op exacte datum/tijd
    if (fase.type === 'presentatie' && fase.datumType === 'zelf' && faseStartDatum) {
      const presentatieWeekStart = getWeekStartForDate(faseStartDatum);
      const presentatieDagIndex = getDayOfWeekFromDate(faseStartDatum);
      // Parse tijd (format: "16:00" of "16:30")
      const startUur = fase.tijd ? parseInt(fase.tijd.split(':')[0]) : 14;

      // Voeg presentatie toe voor elke aanwezige medewerker
      if (medewerkers.length > 0) {
        for (const mw of medewerkers) {
          taken.push({
            werknemer_naam: mw,
            fase_naam: fase.fase_naam,
            dag_van_week: presentatieDagIndex,
            week_start: presentatieWeekStart,
            start_uur: startUur,
            duur_uren: urenPerDag, // Meestal 2 uur voor presentaties
            werktype: 'extern', // Presentaties zijn extern (roze)
          });
        }
      } else {
        // Geen specifieke medewerkers, maak toch een blok
        taken.push({
          werknemer_naam: 'Team',
          fase_naam: fase.fase_naam,
          dag_van_week: presentatieDagIndex,
          week_start: presentatieWeekStart,
          start_uur: startUur,
          duur_uren: urenPerDag,
          werktype: 'extern', // Presentaties zijn extern (roze)
        });
      }
      continue; // Ga naar volgende fase
    }

    // Determine starting point for werkzaamheden
    let currentWeekStart = faseStartDatum ? getWeekStartForDate(faseStartDatum) : defaultWeekStart;
    let currentDayIndex = faseStartDatum ? getDayOfWeekFromDate(faseStartDatum) : 0;

    // Check medewerkerDetails for specific hours per person (nieuwe format: uren totaal)
    const medewerkerUren: Record<string, number> = {};
    if (fase.medewerkerDetails?.length > 0) {
      for (const md of fase.medewerkerDetails) {
        // Nieuwe format: md.uren = totaal uren
        medewerkerUren[md.naam] = md.uren || 0;
      }
    }

    if (medewerkers.length === 0) {
      // Fallback: plan generic blocks
      for (let d = 0; d < dagen; d++) {
        if (currentDayIndex > 4) { currentDayIndex = 0; currentWeekStart = nextWeek(currentWeekStart); }
        taken.push({
          werknemer_naam: 'Medewerker',
          fase_naam: fase.fase_naam,
          dag_van_week: currentDayIndex,
          week_start: currentWeekStart,
          start_uur: 9,
          duur_uren: urenPerDag,
          werktype: 'concept', // Werkzaamheden zijn concept
        });
        currentDayIndex++;
      }
    } else {
      // For each medewerker, plan their specific hours
      for (const mw of medewerkers) {
        const totaalUren = medewerkerUren[mw] || (dagen * urenPerDag);
        let restUren = totaalUren;
        let mwWeekStart = currentWeekStart;
        let mwDayIndex = currentDayIndex;

        while (restUren > 0) {
          if (mwDayIndex > 4) { mwDayIndex = 0; mwWeekStart = nextWeek(mwWeekStart); }

          const blokUren = Math.min(restUren, urenPerDag);
          const slot = getNextFreeSlot(mw, mwWeekStart, mwDayIndex, blokUren);

          if (slot) {
            taken.push({
              werknemer_naam: mw,
              fase_naam: fase.fase_naam,
              dag_van_week: slot.dagVanWeek,
              week_start: slot.weekStart,
              start_uur: slot.startUur,
              duur_uren: blokUren,
              werktype: 'concept', // Werkzaamheden zijn concept
            });
            restUren -= blokUren;
          }
          mwDayIndex++;
        }
      }
    }
  }

  return taken;
}

function nextWeek(weekStart: string): string {
  const d = new Date(weekStart + 'T00:00:00');
  d.setDate(d.getDate() + 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
