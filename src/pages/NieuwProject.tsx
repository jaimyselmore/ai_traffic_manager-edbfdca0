import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ProjectHeader, ProjectHeaderData, emptyProjectHeaderData } from '@/components/forms/ProjectHeader';
import { ProductieFases, ProductieFasesData, emptyProductieFasesData } from '@/components/forms/ProductieFases';

// Simplified team data - will be managed within ProductieFases
interface BetrokkenTeamData {
  accountManagers: string[];
  producers: string[];
  strategen: string[];
  creatieTeam: string[];
  studio: string[];
}

const emptyBetrokkenTeamData: BetrokkenTeamData = {
  accountManagers: [],
  producers: [],
  strategen: [],
  creatieTeam: [],
  studio: [],
};
import { AlgemeenFases, AlgemeenFasesData, emptyAlgemeenFasesData } from '@/components/forms/AlgemeenFases';
import { toast } from '@/hooks/use-toast';
import { saveAanvraag } from '@/components/dashboard/MijnAanvragen';
import { useAuth } from '@/contexts/AuthContext';
import { createProjectAndSchedule } from '@/lib/services/planningAutomation';
import { useClients } from '@/hooks/use-clients';
import { useEmployees } from '@/hooks/use-employees';

const STORAGE_KEY = 'concept_nieuw_project';

type ProjectType = 'algemeen' | 'productie' | '';

interface MedewerkerAllocatie {
  medewerkerId: string;
  aantalDagen: number;
  eenheid: 'dagen' | 'uren';
  toelichting: string;
  ongeveer: boolean;
}

interface TeamAllocatie {
  teamName: string; // bijv "Creative Team 1"
  aantalDagen: number;
  planningType: 'samen_met_team' | 'beide' | '';
  toelichting: string;
  ongeveer: boolean;
}

interface MeetingData {
  id: string;
  type: 'tussentijds' | 'eindpresentatie' | 'kick-off' | 'anders';
  aantalUren: number;
  notitie: string;
}

interface AlgemeenProjectData {
  medewerkerAllocaties: MedewerkerAllocatie[]; // individuele selections
  teamAllocaties: TeamAllocatie[]; // team selections als geheel
  startDatum: string;
  betrokkenPersonen: string[]; // medewerker IDs die betrokken zijn maar niet ingepland (voor meetings)
  meetings: MeetingData[]; // geplande meetings/presentaties
}

const emptyAlgemeenData: AlgemeenProjectData = {
  medewerkerAllocaties: [],
  teamAllocaties: [],
  startDatum: '',
  betrokkenPersonen: [],
  meetings: [],
};

interface NieuwProjectFormData {
  projectHeader: ProjectHeaderData;
  projectType: ProjectType;
  isInternProject: boolean;
  algemeen: AlgemeenProjectData;
  algemeenFases: AlgemeenFasesData;
  betrokkenTeam: BetrokkenTeamData;
  productieFases: ProductieFasesData;
}

const emptyFormData: NieuwProjectFormData = {
  projectHeader: emptyProjectHeaderData,
  projectType: '',
  isInternProject: false,
  algemeen: emptyAlgemeenData,
  algemeenFases: emptyAlgemeenFasesData,
  betrokkenTeam: emptyBetrokkenTeamData,
  productieFases: emptyProductieFasesData,
};

export default function NieuwProject() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: clients = [] } = useClients();
  const { data: employees = [] } = useEmployees();

  const hydrateStoredFormData = (stored: string): NieuwProjectFormData => {
    // NOTE: localStorage can contain older shapes; do a deep-ish merge so nested
    // arrays/objects never become undefined (prevents `.map()` runtime crashes).
    let parsed: Partial<NieuwProjectFormData> = {};
    try {
      parsed = JSON.parse(stored) as Partial<NieuwProjectFormData>;
    } catch {
      return emptyFormData;
    }

    return {
      ...emptyFormData,
      ...parsed,
      isInternProject: parsed.isInternProject ?? false,
      projectHeader: {
        ...emptyProjectHeaderData,
        ...(parsed.projectHeader ?? {}),
      },
      algemeen: {
        ...emptyAlgemeenData,
        ...(parsed.algemeen ?? {}),
        medewerkerAllocaties: (parsed.algemeen?.medewerkerAllocaties ?? []) as MedewerkerAllocatie[],
        teamAllocaties: (parsed.algemeen?.teamAllocaties ?? []) as TeamAllocatie[],
        betrokkenPersonen: (parsed.algemeen?.betrokkenPersonen ?? []) as string[],
        meetings: (parsed.algemeen?.meetings ?? []) as MeetingData[],
      },
      algemeenFases: {
        ...emptyAlgemeenFasesData,
        ...(parsed.algemeenFases ?? {}),
        projectTeamIds: (parsed.algemeenFases?.projectTeamIds ?? []) as string[],
        // Ensure presentaties have workload structure and datumType
        presentaties: (parsed.algemeenFases?.presentaties ?? []).map((p: any) => ({
          ...p,
          datumType: p.datumType ?? (p.datum ? 'zelf' : 'ellen'),
          workload: p.workload ?? { medewerkers: [], aantalDagen: undefined },
        })),
      },
      betrokkenTeam: {
        ...emptyBetrokkenTeamData,
        ...(parsed.betrokkenTeam ?? {}),
      },
      productieFases: {
        ...emptyProductieFasesData,
        ...(parsed.productieFases ?? {}),
        projectTeamIds: (parsed.productieFases?.projectTeamIds ?? []) as string[],
        // `fases` is a nested object inside ProductieFasesData.
        // Ensure it exists even if older stored data misses it.
        fases: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...(emptyProductieFasesData as any).fases,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...((parsed.productieFases as any)?.fases ?? {}),
        },
      } as ProductieFasesData,
    };
  };

  const [formData, setFormData] = useState<NieuwProjectFormData>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return hydrateStoredFormData(stored);
    }
    return emptyFormData;
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Autosave to localStorage on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
  }, [formData]);

  const handleSaveConcept = () => {
    // Save main key (for autosave/reload)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
    // Also save a unique concept copy so it persists even if the main key gets overwritten
    const conceptKey = `concept_data_${Date.now()}`;
    localStorage.setItem(conceptKey, JSON.stringify(formData));
    const selectedClient = clients.find(c => c.id === formData.projectHeader.klantId);
    saveAanvraag({
      id: conceptKey,
      type: 'nieuw-project',
      status: 'concept',
      titel: formData.projectHeader.projectTitel || formData.projectHeader.projectNaam || 'Nieuw project',
      klant: selectedClient?.name,
      datum: new Date().toISOString(),
      projectType: formData.projectType,
      storageKey: conceptKey,
    });
    toast({
      title: 'Concept opgeslagen',
      description: 'Je kunt het terugvinden bij "Mijn aanvragen" op het dashboard.',
    });
    navigate('/');
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.projectHeader.klantId) {
      newErrors.klantId = 'Selecteer een klant';
    }
    if (!formData.projectHeader.projectNaam?.trim()) {
      newErrors.projectNaam = 'Voer een projectnaam in';
    }
    if (!formData.projectHeader.startDatum) {
      newErrors.startDatum = 'Selecteer een startdatum';
    }
    if (!formData.projectHeader.deadline) {
      newErrors.deadline = 'Selecteer een deadline';
    }
    if (!formData.projectType) {
      newErrors.projectType = 'Selecteer een projecttype';
    }
    if (formData.projectType === 'algemeen') {
      // Valideer dat er minimaal 1 teamlid is geselecteerd
      if (formData.algemeenFases.projectTeamIds.length === 0) {
        newErrors.projectTeam = 'Selecteer minimaal één teamlid';
      }
    }
    if (formData.projectType === 'productie') {
      // Valideer dat er minimaal 1 teamlid is geselecteerd
      if (formData.productieFases.projectTeamIds.length === 0) {
        newErrors.projectTeam = 'Selecteer minimaal één teamlid';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const getMissingFieldsMessage = (): string => {
    const missing: string[] = [];
    if (!formData.projectHeader.klantId) missing.push('Klant');
    if (!formData.projectHeader.projectNaam?.trim()) missing.push('Projectnaam');
    if (!formData.projectHeader.startDatum) missing.push('Startdatum');
    if (!formData.projectHeader.deadline) missing.push('Deadline');
    if (!formData.projectType) missing.push('Projecttype');
    if (formData.projectType === 'algemeen') {
      if (formData.algemeenFases.projectTeamIds.length === 0) {
        missing.push('Projectteam');
      }
    }
    if (formData.projectType === 'productie') {
      if (formData.productieFases.projectTeamIds.length === 0) {
        missing.push('Projectteam');
      }
    }
    return missing.join(', ');
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      const missingFields = getMissingFieldsMessage();
      toast({
        title: 'Niet alle verplichte velden zijn ingevuld',
        description: `Ontbrekend: ${missingFields}`,
        variant: 'destructive',
      });
      return;
    }

    if (!user) {
      toast({
        title: 'Fout',
        description: 'Je moet ingelogd zijn om een project aan te maken',
        variant: 'destructive',
      });
      return;
    }

    // Find client name
    const selectedClient = clients.find(c => c.id === formData.projectHeader.klantId);
    const klantNaam = selectedClient?.name || 'Onbekend';

    // Sla template op voor later bewerken (ook na indienen)
    const templateKey = `template_${Date.now()}`;
    localStorage.setItem(templateKey, JSON.stringify(formData));
    saveAanvraag({
      id: templateKey,
      type: 'nieuw-project',
      status: 'ingediend',
      titel: formData.projectHeader.projectTitel || formData.projectHeader.projectNaam || 'Nieuw project',
      klant: klantNaam,
      datum: new Date().toISOString(),
      projectType: formData.projectType,
      storageKey: templateKey,
    });

    // Build fases array based on project type
    const fases: any[] = [];

    if (formData.projectType === 'algemeen') {
      // Verwerk presentaties vanuit algemeenFases
      const defaultDatum = formData.projectHeader.startDatum || formData.projectHeader.datumAanvraag || new Date().toISOString().split('T')[0];

      formData.algemeenFases.presentaties.forEach(presentatie => {
        // Verzamel medewerkers voor deze presentatie
        const medewerkerDetails = presentatie.workload.medewerkers.map(wm => {
          const emp = employees.find(e => e.id === wm.medewerkerId);
          return {
            naam: emp?.name || 'Medewerker',
            medewerkerId: wm.medewerkerId,
            aantalDagen: wm.aantalDagen,
            urenPerDag: wm.urenPerDag,
          };
        });

        const medewerkerNamen = medewerkerDetails.map(m => m.naam);

        // Voeg workload fase toe (werkzaamheden vóór presentatie)
        if (medewerkerDetails.length > 0) {
          const maxDagen = Math.max(...medewerkerDetails.map(m => m.aantalDagen), 1);
          fases.push({
            fase_naam: `Werkzaamheden - ${presentatie.naam}`,
            medewerkers: medewerkerNamen,
            start_datum: defaultDatum,
            duur_dagen: maxDagen,
            uren_per_dag: 8,
            medewerkerDetails: medewerkerDetails.map(m => ({
              naam: m.naam,
              inspanning: m.aantalDagen,
              eenheid: 'dagen',
              urenPerDag: m.urenPerDag,
            })),
          });
        }

        // Voeg presentatie meeting toe
        const presentatieMedewerkers = presentatie.teamIds.map(id => {
          const emp = employees.find(e => e.id === id);
          return emp?.name || '';
        }).filter(Boolean);

        fases.push({
          fase_naam: presentatie.naam,
          type: 'presentatie',
          medewerkers: presentatieMedewerkers,
          start_datum: presentatie.datumType === 'zelf' && presentatie.datum ? presentatie.datum : undefined,
          tijd: presentatie.tijd || undefined,
          locatie: presentatie.locatie || undefined,
          datumType: presentatie.datumType, // 'ellen' of 'zelf'
          duur_dagen: 1,
          uren_per_dag: 2, // Standaard 2 uur voor presentatie
        });
      });

      // Als er geen presentaties zijn maar wel een projectteam, maak een standaard fase
      if (formData.algemeenFases.presentaties.length === 0 && formData.algemeenFases.projectTeamIds.length > 0) {
        const teamNamen = formData.algemeenFases.projectTeamIds.map(id => {
          const emp = employees.find(e => e.id === id);
          return emp?.name || '';
        }).filter(Boolean);

        fases.push({
          fase_naam: 'Projectwerk',
          medewerkers: teamNamen,
          start_datum: defaultDatum,
          duur_dagen: 5, // Default 5 dagen
          uren_per_dag: 8,
        });
      }
    } else {
      // For productie: use productie fases
      const productieFases = formData.productieFases.fases;
      const defaultDatum = formData.projectHeader.datumAanvraag || new Date().toISOString().split('T')[0];

      // Helper to check if fase has data and should be included
      const heeftFaseData = (fase: typeof productieFases.pp) =>
        fase && (fase.startDatum || (fase.medewerkers && fase.medewerkers.length > 0) || (fase.dagen && fase.dagen > 0));

      // Helper to convert medewerker IDs to names
      const getMedewerkerNamen = (ids: string[] = []) =>
        ids.map(id => employees.find(e => e.id === id)?.name).filter(Boolean) as string[];

      // All productie fases with their display names
      const faseConfig = [
        { key: 'pp', naam: 'PP (pre-productie)', defaultDagen: 2 },
        { key: 'ppm', naam: 'PPM', defaultDagen: 1 },
        { key: 'shoot', naam: 'Shoot', defaultDagen: 1 },
        { key: 'offlineEdit', naam: 'Offline edit', defaultDagen: 2 },
        { key: 'presentatieOffline', naam: 'Presentatie offline edit', defaultDagen: 1 },
        { key: 'reEdit', naam: 'Re-edit', defaultDagen: 1 },
        { key: 'presentatieReEdit', naam: 'Presentatie re-edit', defaultDagen: 1 },
        { key: 'onlineGrading', naam: 'Online grading', defaultDagen: 2 },
        { key: 'geluid', naam: 'Geluid', defaultDagen: 2 },
        { key: 'presentatieFinals', naam: 'Presentatie finals', defaultDagen: 1 },
        { key: 'deliverables', naam: 'Deliverables', defaultDagen: 1 },
      ] as const;

      faseConfig.forEach(({ key, naam, defaultDagen }) => {
        const fase = productieFases[key];
        if (heeftFaseData(fase)) {
          // Gebruik urenPerDag van de fase als die is ingesteld (bijv. voor PP), anders 8
          const urenPerDag = (fase as any)?.urenPerDag || 8;
          fases.push({
            fase_naam: naam,
            medewerkers: getMedewerkerNamen(fase?.medewerkers),
            medewerkerIds: fase?.medewerkers || [], // Ook de IDs meesturen
            start_datum: fase?.startDatum || defaultDatum,
            eind_datum: fase?.eindDatum || undefined,
            duur_dagen: fase?.dagen || defaultDagen,
            uren_per_dag: urenPerDag,
          });
        }
      });
    }

    // If no fases, create a default one
    if (fases.length === 0) {
      toast({
        title: 'Fout',
        description: 'Selecteer minimaal één fase voor dit project',
        variant: 'destructive',
      });
      return;
    }

    // Resolve betrokkenPersonen IDs to names
    const betrokkenPersonenNamen = (formData.algemeen.betrokkenPersonen || [])
      .map(id => employees.find(e => e.id === id)?.name)
      .filter(Boolean) as string[];

    // Resolve betrokkenTeam IDs to names
    const betrokkenTeamNamen = {
      accountManagers: (formData.betrokkenTeam.accountManagers || [])
        .map(id => employees.find(e => e.id === id)?.name)
        .filter(Boolean) as string[],
      producers: (formData.betrokkenTeam.producers || [])
        .map(id => employees.find(e => e.id === id)?.name)
        .filter(Boolean) as string[],
      strategen: (formData.betrokkenTeam.strategen || [])
        .map(id => employees.find(e => e.id === id)?.name)
        .filter(Boolean) as string[],
      creatieTeam: (formData.betrokkenTeam.creatieTeam || [])
        .map(id => employees.find(e => e.id === id)?.name)
        .filter(Boolean) as string[],
      studio: (formData.betrokkenTeam.studio || [])
        .map(id => employees.find(e => e.id === id)?.name)
        .filter(Boolean) as string[],
    };

    const projectInfo = {
      klant_id: formData.projectHeader.klantId,
      klant_naam: klantNaam,
      projectnaam: formData.projectHeader.projectNaam,
      projectTitel: formData.projectHeader.projectTitel,
      projecttype: formData.projectType,
      isInternProject: formData.isInternProject,
      deadline: formData.projectHeader.deadline,
      fases,
      // Nieuwe velden voor meetings
      betrokkenPersonen: betrokkenPersonenNamen,
      betrokkenTeam: betrokkenTeamNamen,
      meetings: formData.algemeen.meetings || [],
    };

    if (formData.projectType === 'productie') {
      // Productie projecten worden direct opgeslagen, niet via Ellen
      try {
        await createProjectAndSchedule({
          klant_id: formData.projectHeader.klantId,
          klant_naam: klantNaam,
          projectnaam: formData.projectHeader.projectNaam,
          projectTitel: formData.projectHeader.projectTitel,
          volledigProjectId: formData.projectHeader.volledigProjectId,
          isInternProject: formData.isInternProject,
          deadline: formData.projectHeader.deadline,
          fases,
          betrokkenTeam: betrokkenTeamNamen,
        });

        toast({
          title: 'Project aangemaakt',
          description: 'Het productie project is opgeslagen.',
        });

        // Clear localStorage and redirect
        localStorage.removeItem(STORAGE_KEY);
        navigate('/planner');
      } catch (error) {
        console.error('Fout bij aanmaken project:', error);
        toast({
          title: 'Fout',
          description: error instanceof Error ? error.message : 'Onbekende fout bij aanmaken project',
          variant: 'destructive',
        });
      }
    } else {
      // Algemeen project -> navigate to Ellen voorstel page
      navigate('/ellen-voorstel', {
        state: { formData, projectInfo },
      });
    }
  };

  // Check all required fields for enabling submit button
  const canSubmit = () => {
    if (!formData.projectHeader.klantId) return false;
    if (!formData.projectHeader.projectNaam?.trim()) return false;
    if (!formData.projectHeader.startDatum) return false;
    if (!formData.projectHeader.deadline) return false;
    if (!formData.projectType) return false;
    if (formData.projectType === 'algemeen') {
      // Minimaal 1 teamlid nodig
      if (formData.algemeenFases.projectTeamIds.length === 0) return false;
    }
    if (formData.projectType === 'productie') {
      // Minimaal 1 teamlid nodig
      if (formData.productieFases.projectTeamIds.length === 0) return false;
    }
    return true;
  };

  const isSubmitDisabled = !canSubmit();

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="w-full px-6 pt-6 mb-4">
        <button
          type="button"
          className="text-sm text-muted-foreground hover:text-foreground"
          onClick={() => navigate('/')}
        >
          ← Terug naar overzicht
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-6 pb-24 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Nieuw project</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Maak een nieuw project aan in de planning met klant, team en planning.
          </p>
        </div>

        {/* Project Header */}
        <ProjectHeader
          data={formData.projectHeader}
          onChange={(data) => setFormData({ ...formData, projectHeader: data })}
          errors={errors}
        />

        {/* Project Type Selection */}
        <div className="rounded-2xl border border-border bg-card p-6">
          <Label className="text-sm mb-3 block">Projecttype *</Label>
          <RadioGroup
            value={formData.projectType}
            onValueChange={(value: ProjectType) => setFormData({ ...formData, projectType: value })}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="algemeen" id="algemeen" />
              <Label htmlFor="algemeen" className="text-sm font-normal cursor-pointer">
                Algemeen project
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="productie" id="productie" />
              <Label htmlFor="productie" className="text-sm font-normal cursor-pointer">
                Productie project
              </Label>
            </div>
          </RadioGroup>
          {errors.projectType && (
            <p className="text-xs text-destructive mt-1">{errors.projectType}</p>
          )}
        </div>

        {/* Algemeen Project Form - nieuwe fase-gebaseerde structuur */}
        {formData.projectType === 'algemeen' && (
          <>
            <AlgemeenFases
              data={formData.algemeenFases}
              onChange={(data) => setFormData({ ...formData, algemeenFases: data })}
            />
            {errors.projectTeam && (
              <p className="text-xs text-destructive">{errors.projectTeam}</p>
            )}
          </>
        )}

        {/* Productie Project Form - alleen ProductieFases */}
        {formData.projectType === 'productie' && (
          <ProductieFases
            data={formData.productieFases}
            onChange={(data) => setFormData({ ...formData, productieFases: data })}
          />
        )}
      </div>

      {/* Fixed bottom-right buttons */}
      <div className="fixed bottom-4 right-4 flex gap-2">
        <Button variant="ghost" onClick={handleSaveConcept}>
          <Save className="mr-2 h-4 w-4" />
          Opslaan als concept
        </Button>
        <Button onClick={handleSubmit} disabled={isSubmitDisabled}>
          Plan indienen
        </Button>
      </div>
    </div>
  );
}
