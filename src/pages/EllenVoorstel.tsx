import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2, CheckCircle2, XCircle, ArrowLeft, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  duur_uren: number;
}

const DAG_NAMEN = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag'];

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

  // Simuleer Ellen die nadenkt en met een voorstel komt
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
        // Stuur de projectdata naar Ellen om een voorstel te genereren
        const { data, error } = await supabase.functions.invoke('ellen-chat', {
          headers: { Authorization: `Bearer ${sessionToken}` },
          body: {
            sessie_id: `project-${Date.now()}`,
            bericht: buildEllenPrompt(projectInfo),
          },
        });

        if (error) throw new Error(error.message);

        // Check of Ellen een planning voorstel heeft gegenereerd
        if (data?.voorstel?.type === 'planning_voorstel' && data.voorstel.taken) {
          setVoorstellen(data.voorstel.taken);
          setEllenMessage(data.antwoord || 'Hier is mijn voorstel voor de planning:');
        } else {
          // Ellen heeft geen gestructureerd voorstel, genereer een standaard voorstel
          const defaultTaken = generateDefaultVoorstel(projectInfo);
          setVoorstellen(defaultTaken);
          setEllenMessage(data?.antwoord || 'Op basis van je aanvraag heb ik het volgende voorstel gemaakt:');
        }
        setFlowState('voorstel');
      } catch (err) {
        // Fallback: genereer een standaard voorstel zonder Ellen
        const defaultTaken = generateDefaultVoorstel(projectInfo);
        setVoorstellen(defaultTaken);
        setEllenMessage('Ik heb een standaard planning opgesteld op basis van je aanvraag:');
        setFlowState('voorstel');
      }
    };

    // Korte vertraging zodat de "Ellen is aan het werk" animatie zichtbaar is
    const timer = setTimeout(generateVoorstel, 1500);
    return () => clearTimeout(timer);
  }, [projectInfo]);

  const handleApprove = () => {
    setFlowState('client-check');
  };

  const handleClientApprovalNeeded = async (needsClientApproval: boolean) => {
    if (needsClientApproval) {
      // Sla op als concept met status "wacht op klant"
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

    // Direct inplannen
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

      <div className="max-w-3xl mx-auto px-6 pb-24">
        {/* Ellen Working State */}
        {flowState === 'ellen-working' && (
          <div className="flex flex-col items-center justify-center py-20 space-y-6">
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
              <p className="text-muted-foreground text-sm max-w-md">
                Ellen analyseert je aanvraag, checkt beschikbaarheid en stelt een planning samen.
              </p>
            </div>
            <div className="flex gap-1">
              <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        {/* Voorstel State */}
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

            {/* Voorstel blokken */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Voorgestelde planning</h3>
              <div className="border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left p-3 font-medium text-muted-foreground">Medewerker</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Fase</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Dag</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Uren</th>
                    </tr>
                  </thead>
                  <tbody>
                    {voorstellen.map((taak, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="p-3 text-foreground">{taak.werknemer_naam}</td>
                        <td className="p-3 text-foreground">{taak.fase_naam}</td>
                        <td className="p-3 text-muted-foreground">
                          {DAG_NAMEN[taak.dag_van_week] || `Dag ${taak.dag_van_week}`}
                          <span className="text-xs ml-1">({taak.week_start})</span>
                        </td>
                        <td className="p-3">
                          <Badge variant="secondary">{taak.duur_uren}u</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Actieknoppen */}
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
  const parts = [
    `Plan een ${info.projecttype || 'algemeen'} project voor klant "${info.klant_naam}".`,
    `Projectnaam: "${info.projectnaam}".`,
  ];
  if (info.deadline) parts.push(`Deadline: ${info.deadline}.`);
  if (info.fases?.length) {
    parts.push(`Fases: ${info.fases.map((f: any) => `${f.fase_naam} (${f.duur_dagen} dagen, medewerkers: ${f.medewerkers?.length || 0})`).join(', ')}.`);
  }
  return parts.join(' ');
}

function generateDefaultVoorstel(info: any): VoorstelTaak[] {
  const taken: VoorstelTaak[] = [];
  const today = new Date();
  // Start volgende maandag
  const dayOfWeek = today.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + daysUntilMonday);
  const weekStart = nextMonday.toISOString().split('T')[0];

  if (info.fases?.length) {
    let currentDay = 0;
    for (const fase of info.fases) {
      const dagen = fase.duur_dagen || 1;
      for (let d = 0; d < dagen && currentDay < 5; d++) {
        taken.push({
          werknemer_naam: fase.medewerkers?.[0] || 'Medewerker',
          fase_naam: fase.fase_naam,
          dag_van_week: currentDay % 5,
          week_start: weekStart,
          duur_uren: fase.uren_per_dag || 8,
        });
        currentDay++;
      }
    }
  }

  return taken;
}
