import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2, CheckCircle2, XCircle, ArrowLeft, Send, Check, ChevronLeft, ChevronRight, X, Trash2, BookmarkIcon } from 'lucide-react';
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
function RobotFaceInline({ happy, size = 40 }: { happy?: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="32" y1="4" x2="32" y2="13" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <circle cx="32" cy="4" r="3" fill="currentColor" />
      <rect x="10" y="13" width="44" height="36" rx="10" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="2.5" />
      {happy ? (
        <>
          <path d="M20 27 Q24 23 28 27" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <path d="M36 27 Q40 23 44 27" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <path d="M20 38 Q32 50 44 38" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <ellipse cx="18" cy="38" rx="5" ry="3" fill="currentColor" fillOpacity="0.2" />
          <ellipse cx="46" cy="38" rx="5" ry="3" fill="currentColor" fillOpacity="0.2" />
        </>
      ) : (
        <>
          <circle cx="24" cy="27" r="4" fill="currentColor" />
          <circle cx="40" cy="27" r="4" fill="currentColor" />
          <circle cx="26" cy="25" r="1.5" fill="white" fillOpacity="0.6" />
          <circle cx="42" cy="25" r="1.5" fill="white" fillOpacity="0.6" />
          <path d="M23 38 Q32 45 41 38" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        </>
      )}
      <rect x="22" y="49" width="20" height="5" rx="2.5" fill="currentColor" fillOpacity="0.3" />
    </svg>
  );
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
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [draggingTask, setDraggingTask] = useState<{ task: VoorstelTaak; index: number } | null>(null);
  const [addTaskCell, setAddTaskCell] = useState<{ medewerker: string; dayIndex: number; hour: number } | null>(null);
  const [newTaskNaam, setNewTaskNaam] = useState('');
  const [newTaskDuur, setNewTaskDuur] = useState(2);
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

        if (!isMeeting) {
          // ── PROJECT: Deterministische planning volledig in de frontend ──────────
          // Workloads worden HIER gepland — geen backend slot-finding meer.
          // Alleen 'ellen bepaalt' presentaties gaan nog naar de Edge Function.

          // Pre-fetch bestaande taken voor alle betrokken medewerkers in de projectperiode
          // zodat de scheduler geen conflict maakt met andere lopende projecten
          let bestaandeTaken: Array<{ werknemer_naam: string; week_start: string; dag_van_week: number }> = [];
          if (alleMedewerkers.length > 0) {
            const eindDatumFetch = toISODate(projectInfo.deadline) || (() => {
              const d = new Date();
              d.setDate(d.getDate() + 120);
              return d.toISOString().split('T')[0];
            })();
            // Alleen 'vast' en 'wacht_klant' tellen als bezet — concepts/templates worden genegeerd
            const { data: takenData } = await supabase
              .from('taken')
              .select('werknemer_naam, week_start, dag_van_week')
              .in('werknemer_naam', alleMedewerkers)
              .gte('week_start', toISODate(startDatum) || startDatum)
              .lte('week_start', eindDatumFetch)
              .in('plan_status', ['vast', 'wacht_klant']);
            bestaandeTaken = takenData || [];
          }

          const { workloadTaken, ellenPresentatieFases } = buildFrontendSchedule(projectInfo, bestaandeTaken);
          const fixedPresentatieTaken = buildPresentatieTaken(projectInfo);

          if (!ellenPresentatieFases) {
            // Geen 'ellen bepaalt' presentaties → alles deterministisch, geen API-call nodig
            setVoorstellen([...workloadTaken, ...fixedPresentatieTaken]);
            setEllenUitleg('');
            setEllenMessage('');
            setFlowState('voorstel');
            return;
          }

          // Stuur ALLEEN de 'ellen bepaalt' presentaties naar de Edge Function
          const invokePromise = supabase.functions.invoke('ellen-chat', {
            headers: { Authorization: `Bearer ${sessionToken}` },
            body: {
              sessie_id: `project-${Date.now()}`,
              bericht: prompt,
              project_data: {
                medewerkers: alleMedewerkers,
                klant_naam: projectInfo.klant_naam || (projectInfo.geenProject ? 'Intern' : 'Onbekend'),
                project_naam: projectInfo.projectnaam || projectInfo.klant_naam || 'Project',
                start_datum: toISODate(startDatum) || startDatum,
                eind_datum: toISODate(projectInfo.deadline),
                direct_plan_fases: ellenPresentatieFases,
              },
            },
          });

          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Ellen timeout na 28 seconden')), 28000)
          );

          try {
            const result = await Promise.race([invokePromise, timeoutPromise]);
            const { data, error } = result as { data: any; error: any };

            if (error) {
              const errorMsg = error.message || '';
              if (errorMsg.includes('429') || data?.code === 'RATE_LIMITED') {
                toast({ title: 'Even geduld', description: 'AI is tijdelijk overbelast. Probeer het over 30 seconden opnieuw.', variant: 'destructive' });
              }
              // Fallback: toon workload + vaste presentaties zonder Ellen-presentaties
              setVoorstellen([...workloadTaken, ...fixedPresentatieTaken]);
              setEllenUitleg('Let op: Ellen kon de presentatiedatum niet automatisch kiezen. Het werkzaamhedenplan staat wel klaar.');
              setFlowState('voorstel');
              return;
            }

            // Voeg Ellen's presentatietaken toe aan de frontend-geplande taken
            const ellenTaken = data?.voorstel?.taken || [];
            setVoorstellen([...workloadTaken, ...fixedPresentatieTaken, ...ellenTaken]);
            setEllenUitleg(cleanEllenText(data?.antwoord || ''));
            setEllenMessage('');
            setFlowState('voorstel');
          } catch (err: any) {
            console.error('Ellen presentatie error:', err);
            // Fallback: toon wat we hebben
            setVoorstellen([...workloadTaken, ...fixedPresentatieTaken]);
            setEllenUitleg('Let op: Ellen kon de presentatiedatum niet bepalen (timeout). Het werkzaamhedenplan staat klaar.');
            setFlowState('voorstel');
          }
          return;
        }

        // ── MEETING: bestaande flow ongewijzigd ────────────────────────────────
        const invokePromise = supabase.functions.invoke('ellen-chat', {
          headers: { Authorization: `Bearer ${sessionToken}` },
          body: {
            sessie_id: `meeting-${Date.now()}`,
            bericht: prompt,
            project_data: {
              medewerkers: alleMedewerkers,
              klant_naam: projectInfo.klant_naam || (projectInfo.geenProject ? 'Intern' : 'Onbekend'),
              project_naam: projectInfo.projectnaam || projectInfo.klant_naam || 'Project',
              start_datum: toISODate(startDatum) || startDatum,
              eind_datum: toISODate(projectInfo.datum),
              direct_plan_fases: null,
            },
          },
        });

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Ellen timeout na 28 seconden')), 28000)
        );

        const result = await Promise.race([invokePromise, timeoutPromise]);
        const { data, error } = result as { data: any; error: any };

        if (error) {
          const errorMsg = error.message || '';
          if (errorMsg.includes('429') || data?.code === 'RATE_LIMITED') {
            toast({ title: 'Even geduld', description: 'AI is tijdelijk overbelast. Probeer het over 30 seconden opnieuw.', variant: 'destructive' });
          }
          throw new Error(errorMsg);
        }

        if (data?.voorstel?.type === 'planning_voorstel' && data.voorstel.taken?.length > 0) {
          setVoorstellen(data.voorstel.taken);
          setEllenUitleg(cleanEllenText(data?.antwoord || ''));
          setEllenMessage('');
          setFlowState('voorstel');
        } else {
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

  // Deadline als Date object voor grid-markering
  const deadlineDate = useMemo(() => {
    const dl = projectInfo?.deadline;
    if (!dl) return null;
    const p = parseDatumParts(dl);
    if (!p) return null;
    return new Date(p.year, p.month, p.day);
  }, [projectInfo?.deadline]);

  // Totaal ingeplande uren per medewerker (voor blauwe kaart)
  const urenPerPersoon = useMemo(() => {
    const result: Record<string, number> = {};
    voorstellen.forEach(t => {
      result[t.werknemer_naam] = (result[t.werknemer_naam] || 0) + t.duur_uren;
    });
    return result;
  }, [voorstellen]);

  // Reset naar eerste week zodra er een nieuw voorstel is
  useEffect(() => {
    if (voorstellen.length > 0) setSelectedWeekIndex(0);
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

  // Presentatienamen uit het project (voor kleur + subtitle)
  const presentatieNamenSet = new Set(
    (projectInfo?.fases || [])
      .filter((f: any) => f.type === 'presentatie')
      .map((f: any) => (f.fase_naam || '').toLowerCase())
  );

  const getFaseColor = (faseNaam: string, werktype?: string) => {
    // Presentaties altijd dezelfde kleur (extern/roze)
    if (presentatieNamenSet.has((faseNaam || '').toLowerCase())) return 'bg-task-extern';
    // Werktype check
    if (werktype && WERKTYPE_COLORS[werktype]) return WERKTYPE_COLORS[werktype];
    // Fallback naar fase naam
    return FASE_COLORS[faseNaam] || FASE_COLORS['Algemeen'];
  };

  // Haal de gekoppelde presentatienaam op uit een werkzaamheden fase_naam
  const getWorkloadSubtitle = (faseNaam: string): string | null => {
    const m = faseNaam.match(/^Werkzaamheden\s*[-–]\s*(.+)$/i);
    return m ? `→ ${m[1]}` : null;
  };

  const handleDragStart = (e: React.DragEvent, task: VoorstelTaak, index: number) => {
    setDraggingTask({ task, index });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, medewerker: string, dayIndex: number, hour: number) => {
    e.preventDefault();
    if (!draggingTask) return;
    const updated = [...voorstellen];
    updated[draggingTask.index] = {
      ...draggingTask.task,
      werknemer_naam: medewerker,
      dag_van_week: dayIndex,
      start_uur: hour,
      week_start: currentWeekISO,
    };
    setVoorstellen(updated);
    setDraggingTask(null);
  };

  const handleCellClick = (medewerker: string, dayIndex: number, hour: number) => {
    const voorstelTasks = getVoorstelTasksForCell(medewerker, dayIndex, hour);
    const bestaandeTasks = getBestaandeTasksForCell(medewerker, dayIndex, hour);
    if (voorstelTasks.length === 0 && bestaandeTasks.length === 0 && hour !== 13) {
      const faseNames = [...new Set(voorstellen.map(t => t.fase_naam))];
      setNewTaskNaam(faseNames[0] || 'Werkzaamheden');
      setNewTaskDuur(2);
      setAddTaskCell({ medewerker, dayIndex, hour });
    }
  };

  const handleAddTask = () => {
    if (!addTaskCell || !newTaskNaam.trim()) return;
    const newTask: VoorstelTaak = {
      werknemer_naam: addTaskCell.medewerker,
      fase_naam: newTaskNaam.trim(),
      dag_van_week: addTaskCell.dayIndex,
      week_start: currentWeekISO,
      start_uur: addTaskCell.hour,
      duur_uren: newTaskDuur,
    };
    setVoorstellen([...voorstellen, newTask]);
    setAddTaskCell(null);
  };

  const handleRemoveTask = (index: number) => {
    setVoorstellen(voorstellen.filter((_, i) => i !== index));
  };

  const handleExitClick = () => {
    // Toon dialog alleen als er een voorstel is, anders gewoon terug
    if (['voorstel', 'color-select', 'client-check'].includes(flowState)) {
      setShowExitDialog(true);
    } else {
      navigate(-1);
    }
  };

  const handleSaveAsConcept = () => {
    if (projectInfo) {
      saveAanvraag({
        id: `concept-${Date.now()}`,
        type: 'nieuw-project',
        status: 'concept',
        titel: projectInfo.projectnaam || projectInfo.klant_naam || 'Naamloos project',
        klant: projectInfo.klant_naam,
        datum: new Date().toISOString(),
        projectType: projectInfo.projecttype,
        projectInfo,
      });
      toast({ title: 'Concept opgeslagen', description: 'Je vindt het terug bij Mijn aanvragen.' });
    }
    setShowExitDialog(false);
    navigate('/');
  };

  const handleDeleteAndExit = () => {
    setShowExitDialog(false);
    navigate(-1);
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      {/* Exit dialog */}
      <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Voorstel verlaten?</AlertDialogTitle>
            <AlertDialogDescription>
              Wat wil je doen met dit planningsvoorstel?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleSaveAsConcept}
            >
              <BookmarkIcon className="h-4 w-4" />
              Als concept opslaan
            </Button>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
              onClick={handleDeleteAndExit}
            >
              <Trash2 className="h-4 w-4" />
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Header balk */}
      <div className="sticky top-0 z-10 w-full px-6 h-12 flex items-center justify-between border-b border-border bg-card/80 backdrop-blur-sm">
        <button
          type="button"
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Terug
        </button>
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          onClick={handleExitClick}
          title="Sluiten"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="max-w-5xl mx-auto px-6 pb-24">
        {/* Ellen Working State with workflow steps */}
        {flowState === 'ellen-working' && (
          <div className="flex flex-col items-center justify-center py-20">

            {/* Avatar with pulsing ring */}
            <div className="relative mb-8">
              {/* Outer pulse ring */}
              <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: '2s' }} />
              {/* Avatar circle */}
              <div className="relative w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary ring-1 ring-primary/20">
                <RobotFaceInline size={44} />
              </div>
            </div>

            {/* Title */}
            <h2 className="text-lg font-semibold text-foreground mb-1">Ellen is aan het werk</h2>
            <p className="text-sm text-muted-foreground mb-8">
              Stap {Math.min(completedSteps.length + 1, WORKFLOW_STEPS.length)} van {WORKFLOW_STEPS.length}
            </p>

            {/* Progress bar */}
            <div className="w-64 h-1 rounded-full bg-muted mb-8 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
                style={{ width: `${(completedSteps.length / WORKFLOW_STEPS.length) * 100}%` }}
              />
            </div>

            {/* Pipeline steps */}
            <div className="w-72 space-y-0">
              {WORKFLOW_STEPS.map((step, i) => {
                const isCompleted = completedSteps.includes(i);
                const isActive = activeStep === i && !isCompleted;
                const isPending = !isCompleted && !isActive;
                const isLast = i === WORKFLOW_STEPS.length - 1;

                return (
                  <div key={i} className="flex gap-3">
                    {/* Left: connector track */}
                    <div className="flex flex-col items-center flex-shrink-0 w-6">
                      {/* Step dot */}
                      <div className={cn(
                        'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 z-10',
                        isCompleted && 'bg-primary text-primary-foreground',
                        isActive && 'bg-primary/15 ring-2 ring-primary text-primary',
                        isPending && 'bg-muted text-muted-foreground'
                      )}>
                        {isCompleted ? (
                          <Check className="h-3 w-3" />
                        ) : isActive ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <span className="text-[10px] font-semibold">{i + 1}</span>
                        )}
                      </div>
                      {/* Connector line */}
                      {!isLast && (
                        <div className={cn(
                          'w-px flex-1 my-1 min-h-[16px] transition-colors duration-500',
                          isCompleted ? 'bg-primary/40' : 'bg-border'
                        )} />
                      )}
                    </div>

                    {/* Right: label */}
                    <div className={cn(
                      'pb-4 pt-0.5 flex-1 transition-all duration-300',
                      isLast && 'pb-0'
                    )}>
                      <span className={cn(
                        'text-sm transition-all duration-300',
                        isActive && 'text-foreground font-medium',
                        isCompleted && 'text-muted-foreground',
                        isPending && 'text-muted-foreground/50'
                      )}>
                        {step.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Timeout warning */}
            {workingTooLong && (
              <div className="mt-8 w-72 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 space-y-3">
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400">
                    <svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 11.5a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5zm.75-3.25a.75.75 0 0 1-1.5 0v-4a.75.75 0 0 1 1.5 0v4z"/></svg>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      Dit duurt langer dan verwacht ({secondsElapsed}s)
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      Ellen is mogelijk overbelast.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1 cursor-pointer" onClick={() => navigate('/nieuw-project')}>
                    Terug
                  </Button>
                  <Button size="sm" className="flex-1 cursor-pointer" onClick={retryGeneration}>
                    Opnieuw
                  </Button>
                </div>
              </div>
            )}

            {/* Cancel */}
            {!workingTooLong && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-8 text-muted-foreground cursor-pointer"
                onClick={() => navigate('/nieuw-project')}
              >
                Annuleren
              </Button>
            )}
          </div>
        )}

        {/* Voorstel State with mini planner */}
        {flowState === 'voorstel' && (
          <div className="pt-6 space-y-5">

            {/* ── Header ── */}
            <div className="flex items-start justify-between gap-6">
              {/* Project identity */}
              <div>
                <h1 className="text-base font-semibold text-foreground leading-snug">
                  {projectInfo?.klant_naam} — {projectInfo?.projectnaam}
                </h1>
                {projectInfo?.volledigProjectId && (
                  <p className="text-xs text-muted-foreground mt-0.5">{projectInfo.volledigProjectId}</p>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">
                  {projectInfo?.startDatum && toDutchDate(projectInfo.startDatum)}
                  {projectInfo?.startDatum && projectInfo?.deadline && ' → '}
                  {projectInfo?.deadline && toDutchDate(projectInfo.deadline)}
                </p>
              </div>

              {/* Uren per persoon als pills */}
              {Object.keys(urenPerPersoon).length > 0 && (
                <div className="flex flex-wrap justify-end gap-2">
                  {Object.entries(urenPerPersoon).map(([naam, uren]) => (
                    <div key={naam} className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs">
                      <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-[9px] font-semibold text-primary">
                        {naam.split(' ').map((n: string) => n[0]).join('').substring(0, 2)}
                      </div>
                      <span className="text-foreground font-medium">{naam}</span>
                      <span className="text-muted-foreground tabular-nums">{uren}u</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Ellen banner — alleen bij feedback of echte uitleg */}
            {(laatsteFeedback || (ellenUitleg && ellenUitleg !== 'Planning aangemaakt op basis van het template.')) && (
              <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
                <div className="mt-0.5 text-primary flex-shrink-0">
                  <RobotFaceInline size={16} happy />
                </div>
                <p className="text-sm text-foreground leading-relaxed">
                  {ellenUitleg && ellenUitleg !== 'Planning aangemaakt op basis van het template.'
                    ? ellenUitleg
                    : `Feedback verwerkt: "${laatsteFeedback}"`}
                </p>
              </div>
            )}

            {/* ── Planning grid — full width ── */}
            <div className="space-y-3">
              {/* Week navigation */}
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Voorgestelde planning</h3>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={selectedWeekIndex === 0}
                    onClick={() => setSelectedWeekIndex(i => i - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-foreground min-w-[230px] text-center px-1">
                    {weekLabel}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={selectedWeekIndex >= allWeeks.length - 1}
                    onClick={() => setSelectedWeekIndex(i => i + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground ml-1 tabular-nums">
                    {selectedWeekIndex + 1}/{allWeeks.length}
                  </span>
                </div>
              </div>

              {tasksThisWeek.length === 0 && bestaandeThisWeek.length === 0 && (
                <div className="flex items-center justify-center py-12 text-muted-foreground text-sm border border-border rounded-lg bg-card">
                  Geen blokken ingepland in deze week
                </div>
              )}
              {(tasksThisWeek.length > 0 || bestaandeThisWeek.length > 0) && (
              <div className="w-full rounded-lg border border-border bg-card overflow-x-auto">
                <table className="w-full border-collapse table-fixed min-w-[640px]">
                  <thead>
                    <tr className="bg-muted/40">
                      <th className="border-b border-r border-border px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground w-40">
                        Medewerker
                      </th>
                      <th className="border-b border-r border-border px-1 py-2.5 text-center text-[10px] font-semibold text-muted-foreground w-10">
                        Uur
                      </th>
                      {weekDates.map((date, index) => {
                        const isDeadline = deadlineDate &&
                          date.getFullYear() === deadlineDate.getFullYear() &&
                          date.getMonth() === deadlineDate.getMonth() &&
                          date.getDate() === deadlineDate.getDate();
                        return (
                          <th
                            key={index}
                            className={cn(
                              "border-b border-r border-border px-2 py-2.5 text-center text-xs font-semibold",
                              isDeadline
                                ? "bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300"
                                : "text-foreground"
                            )}
                          >
                            <div>{DAG_NAMEN[index]}</div>
                            <div className="text-[10px] font-normal opacity-60 mt-0.5">
                              {date.getDate()}/{date.getMonth() + 1}
                            </div>
                            {isDeadline && (
                              <div className="text-[9px] font-bold mt-0.5 text-amber-700 dark:text-amber-400 uppercase tracking-wide">
                                Deadline
                              </div>
                            )}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {medewerkers.map((medewerker) => (
                      TIME_SLOTS.map((hour, hourIndex) => (
                        <tr key={`${medewerker}-${hour}`} className={cn(hour === 13 && 'bg-muted/20')}>
                          {hourIndex === 0 && (
                            <td
                              rowSpan={TIME_SLOTS.length}
                              className="bg-card border-b border-r border-border px-3 py-2 align-middle"
                            >
                              <div className="flex items-center gap-2 group/person">
                                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
                                  {medewerker.split(' ').map((n: string) => n[0]).join('').substring(0, 2)}
                                </div>
                                <div className="font-medium text-foreground text-xs leading-tight flex-1 min-w-0">{medewerker}</div>
                                <button
                                  type="button"
                                  title="Taak toevoegen"
                                  onClick={() => {
                                    const faseNames = [...new Set(voorstellen.map(t => t.fase_naam))];
                                    setNewTaskNaam(faseNames[0] || 'Werkzaamheden');
                                    setNewTaskDuur(2);
                                    setAddTaskCell({ medewerker, dayIndex: 0, hour: 9 });
                                  }}
                                  className="opacity-0 group-hover/person:opacity-100 flex-shrink-0 flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 hover:bg-primary/20 text-primary transition-all"
                                >
                                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                </button>
                              </div>
                            </td>
                          )}
                          <td className={cn(
                            "border-b border-r border-border px-1 py-0 text-center text-[10px] font-medium",
                            hour === 13 ? 'bg-muted/20 text-muted-foreground/50' : 'bg-card text-muted-foreground/60'
                          )}>
                            {hour === 13 ? '—' : `${hour}:00`}
                          </td>
                          {weekDates.map((date, dayIndex) => {
                            const voorstelTasks = getVoorstelTasksForCell(medewerker, dayIndex, hour);
                            const bestaandeTasks = getBestaandeTasksForCell(medewerker, dayIndex, hour);
                            const isLunch = hour === 13;
                            const isDeadlineCol = deadlineDate &&
                              date.getFullYear() === deadlineDate.getFullYear() &&
                              date.getMonth() === deadlineDate.getMonth() &&
                              date.getDate() === deadlineDate.getDate();

                            return (
                              <td
                                key={dayIndex}
                                className={cn(
                                  "border-b border-r border-border p-0 relative",
                                  isLunch && 'bg-muted/20',
                                  isDeadlineCol && !isLunch && 'bg-amber-50/60 dark:bg-amber-950/15',
                                  !isLunch && draggingTask && 'hover:bg-primary/5 cursor-crosshair'
                                )}
                                style={{ height: `${CELL_HEIGHT}px` }}
                                onDragOver={!isLunch ? handleDragOver : undefined}
                                onDrop={!isLunch ? (e) => handleDrop(e, medewerker, dayIndex, hour) : undefined}
                                onClick={() => handleCellClick(medewerker, dayIndex, hour)}
                              >
                                {bestaandeTasks.map((taak, ti) => {
                                  if (!isTaskStart(taak, hour)) return null;
                                  const blockHeight = Math.min(taak.duur_uren, 18 - hour) * CELL_HEIGHT;
                                  return (
                                    <div
                                      key={`bestaand-${ti}`}
                                      className="absolute left-0.5 right-0.5 rounded px-1.5 py-0.5 text-xs text-white overflow-hidden bg-slate-400 z-10"
                                      style={{ height: `${blockHeight - 2}px`, top: '1px' }}
                                      title={`${taak.klant_naam} • ${taak.fase_naam} • ${taak.duur_uren}u (bestaand)`}
                                    >
                                      <div className="truncate font-medium">{taak.klant_naam}</div>
                                      <div className="truncate text-[10px] opacity-80">{taak.fase_naam}</div>
                                      {taak.duur_uren > 2 && <div className="text-[10px] opacity-70 mt-0.5">{taak.duur_uren}u</div>}
                                    </div>
                                  );
                                })}
                                {voorstelTasks.map((taak, ti) => {
                                  const taskIndex = voorstellen.findIndex(t =>
                                    t.werknemer_naam === taak.werknemer_naam &&
                                    t.fase_naam === taak.fase_naam &&
                                    t.week_start === taak.week_start &&
                                    t.dag_van_week === taak.dag_van_week &&
                                    t.start_uur === taak.start_uur
                                  );
                                  if (!isTaskStart(taak, hour)) return null;
                                  const blockHeight = Math.min(taak.duur_uren, 18 - hour) * CELL_HEIGHT;
                                  const isPresentatie = presentatieNamenSet.has((taak.fase_naam || '').toLowerCase())
                                    || taak.fase_naam?.toLowerCase().includes('presentatie')
                                    || taak.fase_naam?.toLowerCase().includes('meeting');
                                  return (
                                    <div
                                      key={`voorstel-${ti}`}
                                      draggable
                                      onDragStart={(e) => handleDragStart(e, taak, taskIndex)}
                                      className={cn(
                                        'absolute left-0.5 right-0.5 rounded px-1.5 py-0.5 text-xs overflow-hidden z-20 cursor-grab active:cursor-grabbing group/task',
                                        isPresentatie
                                          ? 'border-2 border-task-extern/70 bg-task-extern/20 text-task-extern'
                                          : cn('text-white opacity-85 border-2 border-dashed border-white/40', getFaseColor(taak.fase_naam, taak.werktype))
                                      )}
                                      style={{ height: `${blockHeight - 2}px`, top: '1px' }}
                                      title={`${projectInfo?.projectTitel || projectInfo?.klant_naam} • ${taak.fase_naam} • ${taak.duur_uren}u (voorstel)`}
                                    >
                                      <div className="truncate font-medium">{isPresentatie ? taak.fase_naam : (projectInfo?.projectTitel || projectInfo?.klant_naam)}</div>
                                      {!isPresentatie && <div className="truncate text-[10px] opacity-80">{taak.fase_naam}</div>}
                                      {getWorkloadSubtitle(taak.fase_naam) && (
                                        <div className="truncate text-[10px] opacity-60 italic">{getWorkloadSubtitle(taak.fase_naam)}</div>
                                      )}
                                      {taak.duur_uren > 2 && <div className="text-[10px] opacity-70 mt-0.5">{taak.duur_uren}u</div>}
                                      <button
                                        type="button"
                                        onMouseDown={(e) => { e.stopPropagation(); handleRemoveTask(taskIndex); }}
                                        className="absolute top-0.5 right-0.5 hidden group-hover/task:flex items-center justify-center h-3.5 w-3.5 rounded-full bg-black/30 hover:bg-black/50 text-white"
                                      >
                                        <X className="h-2.5 w-2.5" />
                                      </button>
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

              {/* Add task panel */}
              {addTaskCell && (
                <div className="mt-2 rounded-lg border border-primary/30 bg-card p-3 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-foreground">
                      Taak toevoegen voor {addTaskCell.medewerker} — {DAG_NAMEN[addTaskCell.dayIndex]} {addTaskCell.hour}:00
                    </p>
                    <button onClick={() => setAddTaskCell(null)} className="text-muted-foreground hover:text-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={newTaskNaam}
                      onChange={(e) => setNewTaskNaam(e.target.value)}
                      className="flex-1 h-7 text-xs rounded-md border border-border bg-background px-2 focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      {[...new Set(voorstellen.map(t => t.fase_naam))].map(naam => (
                        <option key={naam} value={naam}>{naam}</option>
                      ))}
                    </select>
                    <select
                      value={newTaskDuur}
                      onChange={(e) => setNewTaskDuur(Number(e.target.value))}
                      className="w-20 h-7 text-xs rounded-md border border-border bg-background px-2 focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      {[1,2,3,4,5,6,7,8].map(h => (
                        <option key={h} value={h}>{h}u</option>
                      ))}
                    </select>
                    <Button size="sm" className="h-7 text-xs px-3" onClick={handleAddTask}>
                      Toevoegen
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* ── Footer bar: legend · feedback · actions ── */}
            <div className="flex items-center gap-3 pt-4 border-t border-border">
              {/* Legend */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-slate-400 flex-shrink-0"></div>
                  <span>Bestaand</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-primary/60 border border-dashed border-primary flex-shrink-0"></div>
                  <span>Voorstel</span>
                </div>
                <div className="text-[11px] text-muted-foreground hidden sm:flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" /></svg>
                    Sleep om te verplaatsen
                  </span>
                  <span className="flex items-center gap-1">
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Klik lege cel of persoon om toe te voegen
                  </span>
                </div>
              </div>

              {/* Feedback input — takes remaining space */}
              <div className="flex flex-1 items-center gap-2 min-w-0">
                <input
                  type="text"
                  placeholder="Aanpassen? Bijv. 'Verschuif naar volgende week' of 'Voeg Jakko toe'"
                  className="flex-1 min-w-0 h-8 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground/60"
                  value={feedbackInput}
                  onChange={(e) => setFeedbackInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && feedbackInput.trim() && !isRequestingNewProposal) handleRequestNewProposal(); }}
                  disabled={isRequestingNewProposal}
                />
                <Button
                  onClick={handleRequestNewProposal}
                  disabled={isRequestingNewProposal || !feedbackInput.trim()}
                  size="sm"
                  variant="outline"
                  className="flex-shrink-0"
                >
                  {isRequestingNewProposal ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  <span className="ml-1.5">Opnieuw</span>
                </Button>
              </div>

              {/* Divider */}
              <div className="w-px h-6 bg-border flex-shrink-0" />

              {/* Primary actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button variant="outline" size="sm" onClick={handleReject}>
                  Terug
                </Button>
                <Button size="sm" onClick={handleApprove}>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                  Goedkeuren
                </Button>
              </div>
            </div>

          </div>
        )}

        {/* Color/Werktype Selection */}
        {flowState === 'color-select' && (
          <div className="pt-8 max-w-xl mx-auto space-y-6">
            <div>
              <h2 className="text-base font-semibold text-foreground">Werktype selecteren</h2>
              <p className="text-sm text-muted-foreground mt-1">
                In welke fase zitten we? Dit bepaalt de kleur van de blokken in de planner.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {WERKTYPE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setSelectedWerktype(option.id)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg border transition-all text-left',
                    selectedWerktype === option.id
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border bg-card hover:bg-muted/30'
                  )}
                >
                  <div className={cn('w-3 h-3 rounded-full flex-shrink-0', option.color)} />
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      'text-sm font-medium leading-tight',
                      selectedWerktype === option.id ? 'text-foreground' : 'text-foreground'
                    )}>
                      {option.label}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{option.description}</p>
                  </div>
                  {selectedWerktype === option.id && (
                    <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>

            <Button onClick={handleColorSelected} className="w-full">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Doorgaan
            </Button>
          </div>
        )}

        {/* Client Approval Check */}
        {flowState === 'client-check' && (
          <div className="pt-8 max-w-sm mx-auto space-y-6">
            <div>
              <h2 className="text-base font-semibold text-foreground">Klantgoedkeuring vereist?</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Moet dit voorstel eerst goedgekeurd worden door de klant?
              </p>
            </div>
            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start gap-3"
                onClick={() => handleClientApprovalNeeded(true)}
              >
                <Send className="h-4 w-4 text-muted-foreground" />
                Ja, klant moet goedkeuren
              </Button>
              <Button
                className="w-full justify-start gap-3"
                onClick={() => handleClientApprovalNeeded(false)}
              >
                <CheckCircle2 className="h-4 w-4" />
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

// ── FRONTEND DETERMINISTIC SCHEDULER ──────────────────────────────────────────
// Alle workload-planning gebeurt hier — geen backend slot-finding meer nodig.
// Enige uitzondering: 'ellen bepaalt' presentaties → Edge Function voor datumselectie.

/** Geeft alle werkdagen (Ma-Vr) van startStr (inclusief) t/m endExclStr (exclusief) */
function getWorkingDays(startStr: string, endExclStr: string): string[] {
  const days: string[] = [];
  const end = new Date(endExclStr + 'T00:00:00');
  const cur = new Date(startStr + 'T00:00:00');
  while (cur < end) {
    const dow = cur.getDay();
    if (dow >= 1 && dow <= 5) {
      days.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`);
    }
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

/** Trek N werkdagen af van een datum (voor presentatie-buffer) */
function subtractWorkDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  let subtracted = 0;
  while (subtracted < days) {
    d.setDate(d.getDate() - 1);
    if (d.getDay() >= 1 && d.getDay() <= 5) subtracted++;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Eerstvolgende werkdag (Ma-Vr) ná dateStr — nooit een weekend */
function nextWorkDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Maak een VoorstelTaak van een datum-string + uurinfo */
function dateStrToTask(faseNaam: string, medewerker: string, dateStr: string, startUur: number, duurUren: number): VoorstelTaak {
  const d = new Date(dateStr + 'T00:00:00');
  const dow = d.getDay(); // 1=ma..5=vr
  const dagVanWeek = dow - 1; // 0=ma..4=vr
  const maandag = new Date(d);
  maandag.setDate(d.getDate() - (dow - 1));
  const weekStart = `${maandag.getFullYear()}-${String(maandag.getMonth() + 1).padStart(2, '0')}-${String(maandag.getDate()).padStart(2, '0')}`;
  return { werknemer_naam: medewerker, fase_naam: faseNaam, dag_van_week: dagVanWeek, week_start: weekStart, start_uur: startUur, duur_uren: duurUren };
}

/**
 * Plan totalHours voor één medewerker ACHTERUIT vanuit windowEnd.
 * De meest recente beschikbare dagen (dichtst bij de presentatie) worden als eerste gebruikt.
 * Slaat dagen over die al bezet zijn (occupiedDays — mutatie in-place).
 * Geeft taken terug in chronologische volgorde (vroegste eerst).
 */
function scheduleBackwards(
  faseNaam: string,
  medewerker: string,
  totalHours: number,
  windowStart: string,
  windowEnd: string | null,
  occupiedDays: Map<string, Set<string>>,
  maxPerDay = 8
): VoorstelTaak[] {
  const taken: VoorstelTaak[] = [];
  const used = occupiedDays.get(medewerker) || new Set<string>();

  // Fallback: als geen windowEnd, plan 90 dagen vooruit (slotfase of geen deadline)
  const farFuture = windowEnd ?? (() => {
    const d = new Date(windowStart + 'T00:00:00');
    d.setDate(d.getDate() + 90);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  // Breid het venster tot 4 werkweken terug zodat overflow-uren altijd een plek vinden.
  // Dit voorkomt dat uren stilletjes worden weggegooid als het venster te krap is.
  const extendedStart = (() => {
    const d = new Date(windowStart + 'T00:00:00');
    d.setDate(d.getDate() - 28);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  // Werkdagen in het venster omgekeerd: meest recente dag eerst (dichtst bij presentatie)
  const candidates = getWorkingDays(extendedStart, farFuture)
    .filter(d => !used.has(d))
    .reverse();

  let remaining = totalHours;
  for (const day of candidates) {
    if (remaining <= 0) break;
    const uren = Math.min(maxPerDay, remaining);
    taken.push(dateStrToTask(faseNaam, medewerker, day, 9, uren));
    used.add(day);
    remaining -= uren;
  }

  occupiedDays.set(medewerker, used);
  return taken.reverse(); // Chronologische volgorde teruggeven
}

/**
 * Plan totalHours voor één medewerker VOORUIT vanuit windowStart.
 * Gebruikt voor feedback-verwerkingsperiodes ná presentaties.
 */
function scheduleForward(
  faseNaam: string,
  medewerker: string,
  totalHours: number,
  windowStart: string,
  windowEnd: string | null,
  occupiedDays: Map<string, Set<string>>,
  maxPerDay = 8
): VoorstelTaak[] {
  const taken: VoorstelTaak[] = [];
  const used = occupiedDays.get(medewerker) || new Set<string>();

  const farFuture = windowEnd ?? (() => {
    const d = new Date(windowStart + 'T00:00:00');
    d.setDate(d.getDate() + 90);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const candidates = getWorkingDays(windowStart, farFuture).filter(d => !used.has(d));

  let remaining = totalHours;
  for (const day of candidates) {
    if (remaining <= 0) break;
    const uren = Math.min(maxPerDay, remaining);
    taken.push(dateStrToTask(faseNaam, medewerker, day, 9, uren));
    used.add(day);
    remaining -= uren;
  }

  occupiedDays.set(medewerker, used);
  return taken;
}

/**
 * MILESTONE-ANCHORED BACKWARD SCHEDULER
 *
 * Aanpak (gebaseerd op best practice "milestone-anchored scheduling"):
 *
 * 1. PARSE: Zet de platte fases-array om naar (werkfase[], presentatie) paren.
 *    Elk paar = de werkzaamheden die vóór die presentatie moeten worden afgerond.
 *
 * 2. BACKWARD SCHEDULE: Plan elke werkfase ACHTERUIT vanuit de presentatiedatum.
 *    Zo liggen werkzaamheden altijd zo dicht mogelijk bij hun presentatie.
 *    Venster = [vorige presentatiedatum + 1, huidige presentatiedatum)
 *
 * 3. CONFLICT DETECTION: Als het venster te klein is (presentaties te dicht bij elkaar),
 *    wordt er teruggevallen op het vorige venster + een waarschuwing.
 *
 * Voordeel t.o.v. cascadeStart (forward planning):
 * - Werkt correct als presentaties aaneengesloten staan
 * - Werkt correct voor 'ellen bepaalt' presentaties (venster wordt bepaald door
 *   omliggende vaste datums)
 */

function buildFrontendSchedule(
  info: any,
  bestaandeTaken?: Array<{ werknemer_naam: string; week_start: string; dag_van_week: number }>
): {
  workloadTaken: VoorstelTaak[];
  ellenPresentatieFases: any[] | null;
} {
  const allFases = (info.fases || []) as Array<any>;
  if (!allFases.length) return { workloadTaken: [], ellenPresentatieFases: null };

  const projectStartDatum = toISODate(info.startDatum)
    || toISODate(allFases[0]?.start_datum)
    || new Date().toISOString().split('T')[0];
  const projectDeadline = toISODate(info.deadline) ?? null;

  // ── STAP 1: Parse platte array naar (werkfases[], presentatie) paren ──────────
  type Segment = { werkfases: any[]; presentatie: any | null; feedbackFases: any[] };
  const segments: Segment[] = [];
  let currentWerkfases: any[] = [];

  for (const fase of allFases) {
    if (fase.type === 'presentatie') {
      segments.push({ werkfases: currentWerkfases, presentatie: fase, feedbackFases: [] });
      currentWerkfases = [];
    } else if (fase.type === 'feedback' && segments.length > 0) {
      // Feedback hoort bij de vorige presentatie
      segments[segments.length - 1].feedbackFases.push(fase);
    } else {
      currentWerkfases.push(fase);
    }
  }
  // Resterende werkfases ná de laatste presentatie (slotfase)
  if (currentWerkfases.length > 0) {
    segments.push({ werkfases: currentWerkfases, presentatie: null, feedbackFases: [] });
  }

  // ── STAP 2: Verzamel vaste presentatiedata als ankers ─────────────────────────
  // Nodig om het venster per segment te bepalen
  const fixedDatesBySegmentIndex = new Map<number, string>();
  segments.forEach((seg, idx) => {
    if (seg.presentatie?.datumType === 'zelf' && seg.presentatie?.start_datum) {
      const iso = toISODate(seg.presentatie.start_datum);
      if (iso) fixedDatesBySegmentIndex.set(idx, iso);
    }
  });

  // ── STAP 3: Bepaal venster per segment ────────────────────────────────────────
  // Venster voor segment i = [segmentStart_i, segmentEnd_i)
  // segmentStart_i = dag ná presentatiedatum van segment i-1 (of projectStart)
  // segmentEnd_i = presentatiedatum van segment i (of projectDeadline)
  //
  // Voor 'ellen' presentaties: segmentEnd = eerstvolgende VASTE presentatiedatum erna.
  // Als die er niet is: projectDeadline.
  function getSegmentEnd(segIdx: number): string | null {
    const seg = segments[segIdx];
    if (!seg.presentatie) return projectDeadline;
    if (seg.presentatie.datumType === 'zelf' && seg.presentatie.start_datum) {
      return toISODate(seg.presentatie.start_datum) ?? projectDeadline;
    }
    // 'ellen': zoek eerstvolgende vaste datum als bovengrens
    for (let k = segIdx + 1; k < segments.length; k++) {
      const fixed = fixedDatesBySegmentIndex.get(k);
      if (fixed) return fixed;
    }
    return projectDeadline;
  }

  // ── STAP 4: Plan elk segment backward ─────────────────────────────────────────
  const workloadTaken: VoorstelTaak[] = [];
  const ellenFases: any[] = [];
  // occupiedDays: seed met BEVESTIGDE taken (vast/wacht_klant) van andere projecten.
  // Concept-taken worden genegeerd — die zijn nog niet echt ingepland.
  const occupiedDays = new Map<string, Set<string>>();
  if (bestaandeTaken?.length) {
    for (const taak of bestaandeTaken) {
      // weekStartDagToDateStr inline: week_start + dag_van_week → datum string
      const d = new Date(taak.week_start + 'T00:00:00');
      d.setDate(d.getDate() + taak.dag_van_week);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const used = occupiedDays.get(taak.werknemer_naam) || new Set<string>();
      used.add(dateStr);
      occupiedDays.set(taak.werknemer_naam, used);
    }
  }

  let segmentWindowStart = projectStartDatum; // schuift op na elke vaste presentatie

  for (let segIdx = 0; segIdx < segments.length; segIdx++) {
    const seg = segments[segIdx];
    const segmentEnd = getSegmentEnd(segIdx); // presentatiedatum (exclusief voor workload)

    // Effectief venster: als segmentWindowStart >= segmentEnd is het venster leeg.
    // In dat geval vallen we terug op het totale venster vanaf projectStart.
    // (Dit treedt op als presentaties aaneengesloten staan — constraint violation.)
    const effectiveStart = segmentWindowStart;

    // Voor 'ellen' presentaties: reserveer de laatste 5 werkdagen voor de presentatie zelf.
    // Werkzaamheden eindigen vóór de presentatieweek zodat ze niet overlappen.
    const workloadEnd = (seg.presentatie?.datumType === 'ellen' && segmentEnd)
      ? subtractWorkDays(segmentEnd, 5)
      : segmentEnd;

    // Plan werkfases backward in het venster [effectiveStart, workloadEnd)
    for (const werkfase of seg.werkfases) {
      const faseTaken: VoorstelTaak[] = [];

      if (werkfase.medewerkerDetails?.length > 0) {
        for (const md of werkfase.medewerkerDetails) {
          if (!md.naam || !md.uren) continue;
          const taken = scheduleBackwards(werkfase.fase_naam, md.naam, md.uren, effectiveStart, workloadEnd, occupiedDays);
          faseTaken.push(...taken);
        }
      } else if (werkfase.medewerkers?.length > 0) {
        const totalHours = (werkfase.uren_per_dag || 8) * (werkfase.duur_dagen || 1);
        for (const mwNaam of werkfase.medewerkers) {
          const taken = scheduleBackwards(werkfase.fase_naam, mwNaam, totalHours, effectiveStart, workloadEnd, occupiedDays);
          faseTaken.push(...taken);
        }
      }

      workloadTaken.push(...faseTaken);
    }

    // Ellen presentatie → stuur naar Edge Function met het juiste venster
    if (seg.presentatie?.datumType === 'ellen') {
      const aanwezigen: string[] = (seg.presentatie.medewerkers || []).filter(Boolean);
      if (aanwezigen.length > 0) {
        ellenFases.push({
          fase_naam: seg.presentatie.fase_naam || 'Presentatie',
          type: 'presentatie',
          medewerkers: aanwezigen,
          start_datum: effectiveStart,
          duur_dagen: 1,
          uren_per_dag: 2,
          verdeling: 'laatste_week',
          voorkeur_dagen: ['donderdag', 'vrijdag'],
          _deadline: segmentEnd,
        });
      }
      // Schuif vensterstart door: gebruik segmentEnd als proxy (we weten de exacte datum nog niet)
      if (segmentEnd) segmentWindowStart = nextWorkDay(segmentEnd);
    }

    // Schuif vensterstart door na een vaste presentatie en plan feedbackmomenten
    if (seg.presentatie?.datumType === 'zelf' && seg.presentatie?.start_datum) {
      const presDate = toISODate(seg.presentatie.start_datum);
      if (presDate) {
        // Voeg ochtend-voorbereiding toe als de presentatie in de middag is (tijd >= 13:00)
        const presTijd = seg.presentatie.tijd as string | undefined;
        if (presTijd) {
          const presHour = parseInt(presTijd.split(':')[0], 10);
          if (presHour >= 13) {
            const aanwezigen: string[] = (seg.presentatie.medewerkers || []).filter(Boolean);
            for (const mw of aanwezigen) {
              workloadTaken.push(dateStrToTask(
                `Voorbereiding ${seg.presentatie.fase_naam || 'presentatie'}`,
                mw, presDate, 9, 2
              ));
            }
          }
        }

        const feedbackStart = nextWorkDay(presDate);
        // Plan feedbackfases VOORUIT na de presentatie
        for (const feedbackFase of seg.feedbackFases) {
          if (feedbackFase.medewerkerDetails?.length > 0) {
            for (const md of feedbackFase.medewerkerDetails) {
              if (!md.naam || !md.uren) continue;
              const taken = scheduleForward(
                feedbackFase.fase_naam,
                md.naam,
                md.uren,
                feedbackStart,
                projectDeadline,
                occupiedDays
              );
              workloadTaken.push(...taken);
            }
          } else if (feedbackFase.medewerkers?.length > 0) {
            const totalHours = (feedbackFase.uren_per_dag || 8) * (feedbackFase.duur_dagen || 1);
            for (const mwNaam of feedbackFase.medewerkers) {
              const taken = scheduleForward(
                feedbackFase.fase_naam,
                mwNaam,
                totalHours,
                feedbackStart,
                projectDeadline,
                occupiedDays
              );
              workloadTaken.push(...taken);
            }
          }
        }
        segmentWindowStart = nextWorkDay(presDate);
      }
    }
  }

  return { workloadTaken, ellenPresentatieFases: ellenFases.length > 0 ? ellenFases : null };
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

/** Formatteer datum (dd-MM-yyyy of YYYY-MM-DD) naar Nederlandse notatie: "18 mrt 2026" */
function toDutchDate(dateStr: string | undefined): string {
  if (!dateStr) return '';
  const p = parseDatumParts(dateStr);
  if (!p) return dateStr;
  const m = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
  return `${p.day} ${m[p.month]} ${p.year}`;
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
  const startDatum = toISODate(info.startDatum) || toISODate(info.fases?.[0]?.start_datum) || new Date().toISOString().split('T')[0];
  const deadline = toISODate(info.deadline) || 'niet opgegeven';
  const lines: string[] = [];

  lines.push(`Project: ${info.klant_naam} — ${info.projectTitel || info.projectnaam || 'Nieuw project'}`);
  lines.push(`Start: ${startDatum} | Deadline: ${deadline}`);
  lines.push('');

  (info.fases || []).forEach((f: any) => {
    if (f.type === 'presentatie') {
      const datum = f.datumType === 'zelf' && f.start_datum
        ? `vaste datum ${f.start_datum}${f.tijd ? ` ${f.tijd}` : ''}`
        : 'datum door Ellen';
      lines.push(`Presentatie "${f.fase_naam}": ${datum} — aanwezig: ${f.medewerkers?.join(', ') || '—'}`);
    } else if (f.type === 'feedback') {
      const totaalUren = f.medewerkerDetails?.reduce((s: number, m: any) => s + (m.uren || 0), 0)
        || (f.duur_dagen || 1) * (f.uren_per_dag || 8);
      lines.push(`Feedbackverwerking "${f.fase_naam}": ${f.medewerkers?.join(', ')} — ${totaalUren}u`);
    } else {
      if (f.medewerkerDetails?.length > 0) {
        f.medewerkerDetails.forEach((md: any) => {
          if (md.naam && md.uren > 0) lines.push(`Werk "${f.fase_naam}" — ${md.naam}: ${md.uren}u`);
        });
      } else if (f.medewerkers?.length > 0) {
        const totaal = (f.duur_dagen || 1) * (f.uren_per_dag || 8);
        lines.push(`Werk "${f.fase_naam}" — ${f.medewerkers.join(', ')}: ${totaal}u totaal`);
      }
    }
  });

  if (feedback) {
    lines.push('');
    lines.push(`Feedback op vorig voorstel: "${feedback}"`);
    if (vorigVoorstel?.length) {
      const perMw: Record<string, number> = {};
      vorigVoorstel.forEach(t => { perMw[t.werknemer_naam] = (perMw[t.werknemer_naam] || 0) + 1; });
      lines.push(`Vorig voorstel: ${Object.entries(perMw).map(([n, c]) => `${n} ${c} blok(ken)`).join(', ')}`);
    }
    lines.push('Maak een nieuw plan dat de feedback verwerkt. Behoud wat niet gewijzigd hoeft te worden.');
  } else {
    lines.push('');
    lines.push('Maak een planning voor dit project.');
  }

  return lines.join('\n');
}


function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
