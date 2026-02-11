import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ProjectHeader, ProjectHeaderData, emptyProjectHeaderData } from '@/components/forms/ProjectHeader';
import { BetrokkenTeam, BetrokkenTeamData, emptyBetrokkenTeamData } from '@/components/forms/BetrokkenTeam';
import { ProductieFases, ProductieFasesData, emptyProductieFasesData } from '@/components/forms/ProductieFases';
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
}

interface TeamAllocatie {
  teamName: string; // bijv "Creative Team 1"
  aantalDagen: number;
  planningType: 'samen_met_team' | 'beide' | '';
  toelichting: string;
}

interface AlgemeenProjectData {
  medewerkerAllocaties: MedewerkerAllocatie[]; // individuele selections
  teamAllocaties: TeamAllocatie[]; // team selections als geheel
  startDatum: string;
}

const emptyAlgemeenData: AlgemeenProjectData = {
  medewerkerAllocaties: [],
  teamAllocaties: [],
  startDatum: '',
};

interface NieuwProjectFormData {
  projectHeader: ProjectHeaderData;
  projectType: ProjectType;
  algemeen: AlgemeenProjectData;
  betrokkenTeam: BetrokkenTeamData;
  productieFases: ProductieFasesData;
}

const emptyFormData: NieuwProjectFormData = {
  projectHeader: emptyProjectHeaderData,
  projectType: '',
  algemeen: emptyAlgemeenData,
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
      projectHeader: {
        ...emptyProjectHeaderData,
        ...(parsed.projectHeader ?? {}),
      },
      algemeen: {
        ...emptyAlgemeenData,
        ...(parsed.algemeen ?? {}),
        medewerkerAllocaties: (parsed.algemeen?.medewerkerAllocaties ?? []) as MedewerkerAllocatie[],
      },
      betrokkenTeam: {
        ...emptyBetrokkenTeamData,
        ...(parsed.betrokkenTeam ?? {}),
      },
      productieFases: {
        ...emptyProductieFasesData,
        ...(parsed.productieFases ?? {}),
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
      titel: formData.projectHeader.projectTitel || formData.projectHeader.projectomschrijving || 'Nieuw project',
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
    if (!formData.projectHeader.projectomschrijving) {
      newErrors.projectomschrijving = 'Voer een projectomschrijving in';
    }
    if (!formData.projectType) {
      newErrors.projectType = 'Selecteer een projecttype';
    }
    if (formData.projectType === 'algemeen') {
      const totalSelections = formData.algemeen.medewerkerAllocaties.length + formData.algemeen.teamAllocaties.length;
      if (totalSelections === 0) {
        newErrors.algemeen = 'Selecteer minimaal één medewerker of team';
      }

      // Check if all selected employees have days > 0
      const invalidAllocaties = formData.algemeen.medewerkerAllocaties.filter(a => a.aantalDagen <= 0);
      if (invalidAllocaties.length > 0) {
        newErrors.aantalDagen = 'Alle medewerkers moeten minimaal 1 dag hebben';
      }

      // Check if teams have days > 0
      const invalidTeamAllocaties = formData.algemeen.teamAllocaties.filter(t => t.aantalDagen <= 0);
      if (invalidTeamAllocaties.length > 0) {
        newErrors.aantalDagen = 'Alle teams moeten minimaal 1 dag hebben';
      }

      // Check if teams have planning type selected
      const teamsWithoutPlanningType = formData.algemeen.teamAllocaties.filter(t => !t.planningType);
      if (teamsWithoutPlanningType.length > 0) {
        newErrors.planningType = 'Selecteer voor alle teams hoe ze moeten worden ingepland';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const getMissingFieldsMessage = (): string => {
    const missing: string[] = [];
    if (!formData.projectHeader.klantId) missing.push('Klant');
    if (!formData.projectHeader.projectomschrijving) missing.push('Projectomschrijving');
    if (!formData.projectType) missing.push('Projecttype');
    if (formData.projectType === 'algemeen') {
      const totalSelections = formData.algemeen.medewerkerAllocaties.length + formData.algemeen.teamAllocaties.length;
      if (totalSelections === 0) missing.push('Medewerkers of teams');

      // Check if teams have planning type selected
      const teamsWithoutPlanningType = formData.algemeen.teamAllocaties.filter(t => !t.planningType);
      if (teamsWithoutPlanningType.length > 0) {
        missing.push('Planning type voor teams');
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

    // Build fases array based on project type
    const fases: any[] = [];

    if (formData.projectType === 'algemeen') {
      // Process team allocations
      formData.algemeen.teamAllocaties.forEach(teamAllocatie => {
        const teamMembers = employees.filter(emp => emp.duoTeam === teamAllocatie.teamName);
        const memberIds = teamMembers.map(m => m.id);

        if (teamAllocatie.planningType === 'samen_met_team') {
          fases.push({
            fase_naam: `Algemeen (${teamAllocatie.teamName})`,
            medewerkers: memberIds,
            start_datum: formData.algemeen.startDatum || formData.projectHeader.datumAanvraag || new Date().toISOString().split('T')[0],
            duur_dagen: teamAllocatie.aantalDagen,
            uren_per_dag: 8,
            notities: teamAllocatie.toelichting || undefined
          });
        } else if (teamAllocatie.planningType === 'beide') {
          const teamDagen = Math.floor(teamAllocatie.aantalDagen / 2);
          fases.push({
            fase_naam: `Algemeen (${teamAllocatie.teamName} - samen)`,
            medewerkers: memberIds,
            start_datum: formData.algemeen.startDatum || formData.projectHeader.datumAanvraag || new Date().toISOString().split('T')[0],
            duur_dagen: teamDagen,
            uren_per_dag: 8,
            notities: teamAllocatie.toelichting || undefined
          });
          const individueleDagen = Math.ceil(teamAllocatie.aantalDagen / 2);
          teamMembers.forEach(member => {
            fases.push({
              fase_naam: `Algemeen - ${member.name} (apart)`,
              medewerkers: [member.id],
              start_datum: formData.algemeen.startDatum || formData.projectHeader.datumAanvraag || new Date().toISOString().split('T')[0],
              duur_dagen: individueleDagen,
              uren_per_dag: 8,
              notities: teamAllocatie.toelichting || undefined
            });
          });
        }
      });

      // Process individual medewerker allocations
      formData.algemeen.medewerkerAllocaties.forEach(allocatie => {
        const employee = employees.find(e => e.id === allocatie.medewerkerId);
        const urenPerDag = allocatie.eenheid === 'uren' ? allocatie.aantalDagen : 8;
        const dagenCount = allocatie.eenheid === 'uren' ? Math.ceil(allocatie.aantalDagen / 8) : allocatie.aantalDagen;
        fases.push({
          fase_naam: `Algemeen - ${employee?.name || 'Medewerker'}`,
          medewerkers: [allocatie.medewerkerId],
          start_datum: formData.algemeen.startDatum || formData.projectHeader.datumAanvraag || new Date().toISOString().split('T')[0],
          duur_dagen: dagenCount,
          uren_per_dag: urenPerDag,
          notities: allocatie.toelichting || undefined
        });
      });
    } else {
      // For productie: use productie fases
      const productieFases = formData.productieFases.fases;
      if (productieFases.pp?.enabled) {
        fases.push({ fase_naam: 'PP', medewerkers: productieFases.pp.medewerkers || [], start_datum: productieFases.pp.startDatum || formData.projectHeader.datumAanvraag || new Date().toISOString().split('T')[0], duur_dagen: productieFases.pp.dagen || 2, uren_per_dag: 8 });
      }
      if (productieFases.shoot?.enabled) {
        fases.push({ fase_naam: 'Shoot', medewerkers: productieFases.shoot.medewerkers || [], start_datum: productieFases.shoot.startDatum || formData.projectHeader.datumAanvraag || new Date().toISOString().split('T')[0], duur_dagen: productieFases.shoot.dagen || 1, uren_per_dag: 8 });
      }
      if (productieFases.offlineEdit?.enabled) {
        fases.push({ fase_naam: 'Offline edit', medewerkers: productieFases.offlineEdit.medewerkers || [], start_datum: productieFases.offlineEdit.startDatum || formData.projectHeader.datumAanvraag || new Date().toISOString().split('T')[0], duur_dagen: productieFases.offlineEdit.dagen || 2, uren_per_dag: 8 });
      }
      if (productieFases.onlineGrading?.enabled) {
        fases.push({ fase_naam: 'Online/VFX', medewerkers: productieFases.onlineGrading.medewerkers || [], start_datum: productieFases.onlineGrading.startDatum || formData.projectHeader.datumAanvraag || new Date().toISOString().split('T')[0], duur_dagen: productieFases.onlineGrading.dagen || 2, uren_per_dag: 8 });
      }
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

    // Navigate to Ellen voorstel page instead of creating directly
    const projectInfo = {
      klant_id: formData.projectHeader.klantId,
      klant_naam: klantNaam,
      projectnaam: formData.projectHeader.projectomschrijving,
      projectTitel: formData.projectHeader.projectTitel,
      projecttype: formData.projectType,
      deadline: formData.projectHeader.deadline,
      fases,
    };

    navigate('/ellen-voorstel', {
      state: { formData, projectInfo },
    });
  };

  // Check all required fields for enabling submit button
  const canSubmit = () => {
    if (!formData.projectHeader.klantId) return false;
    if (!formData.projectHeader.projectomschrijving) return false;
    if (!formData.projectType) return false;
    if (formData.projectType === 'algemeen') {
      const totalSelections = formData.algemeen.medewerkerAllocaties.length + formData.algemeen.teamAllocaties.length;
      if (totalSelections === 0) return false;
      // Check if all allocations have valid days
      if (formData.algemeen.medewerkerAllocaties.some(a => a.aantalDagen <= 0)) return false;
      if (formData.algemeen.teamAllocaties.some(t => t.aantalDagen <= 0)) return false;
      // Check if teams have planning type selected
      if (formData.algemeen.teamAllocaties.some(t => !t.planningType)) return false;
    }
    return true;
  };

  const handleMedewerkerToggle = (id: string) => {
    setFormData(prev => {
      const exists = prev.algemeen.medewerkerAllocaties.find(a => a.medewerkerId === id);
      if (exists) {
        // Remove employee
        return {
          ...prev,
          algemeen: {
            ...prev.algemeen,
            medewerkerAllocaties: prev.algemeen.medewerkerAllocaties.filter(a => a.medewerkerId !== id)
          }
        };
      } else {
        // Add employee with default values
        return {
          ...prev,
          algemeen: {
            ...prev.algemeen,
            medewerkerAllocaties: [
              ...prev.algemeen.medewerkerAllocaties,
              {
                medewerkerId: id,
                aantalDagen: 5,
                eenheid: 'dagen',
                toelichting: ''
              }
            ]
          }
        };
      }
    });
  };

  const handleMedewerkerDagenChange = (id: string, dagen: number) => {
    setFormData(prev => ({
      ...prev,
      algemeen: {
        ...prev.algemeen,
        medewerkerAllocaties: prev.algemeen.medewerkerAllocaties.map(a =>
          a.medewerkerId === id ? { ...a, aantalDagen: dagen } : a
        )
      }
    }));
  };

  const handleMedewerkerToelichtingChange = (id: string, toelichting: string) => {
    setFormData(prev => ({
      ...prev,
      algemeen: {
        ...prev.algemeen,
        medewerkerAllocaties: prev.algemeen.medewerkerAllocaties.map(a =>
          a.medewerkerId === id ? { ...a, toelichting } : a
        )
      }
    }));
  };

  const handleMedewerkerEenheidChange = (id: string, eenheid: 'dagen' | 'uren') => {
    setFormData(prev => ({
      ...prev,
      algemeen: {
        ...prev.algemeen,
        medewerkerAllocaties: prev.algemeen.medewerkerAllocaties.map(a =>
          a.medewerkerId === id ? { ...a, eenheid, aantalDagen: eenheid === 'uren' ? 8 : 1 } : a
        )
      }
    }));
  };

  const DAGEN_OPTIES = [
    { value: '0.5', label: '0.5 dag' },
    { value: '1', label: '1 dag' },
    { value: '2', label: '2 dagen' },
    { value: '3', label: '3 dagen' },
    { value: '4', label: '4 dagen' },
    { value: '5', label: '5 dagen' },
    { value: '6', label: '6 dagen' },
    { value: '7', label: '7 dagen' },
    { value: '8', label: '8 dagen' },
    { value: '9', label: '9 dagen' },
    { value: '10', label: '10 dagen' },
  ];

  const UREN_OPTIES = [
    { value: '4', label: '4 uur' },
    { value: '8', label: '8 uur (1 dag)' },
    { value: '16', label: '16 uur (2 dagen)' },
    { value: '24', label: '24 uur (3 dagen)' },
    { value: '32', label: '32 uur (4 dagen)' },
    { value: '40', label: '40 uur (5 dagen)' },
    { value: '48', label: '48 uur (6 dagen)' },
    { value: '56', label: '56 uur (7 dagen)' },
    { value: '60', label: '60 uur' },
    { value: '80', label: '80 uur (10 dagen)' },
  ];

  // Team selection handlers
  const handleTeamToggle = (teamName: string, memberIds: string[]) => {
    setFormData(prev => {
      const teamExists = prev.algemeen.teamAllocaties.find(t => t.teamName === teamName);

      if (teamExists) {
        // Remove team selection and all individual members
        return {
          ...prev,
          algemeen: {
            ...prev.algemeen,
            teamAllocaties: prev.algemeen.teamAllocaties.filter(t => t.teamName !== teamName),
            medewerkerAllocaties: prev.algemeen.medewerkerAllocaties.filter(
              a => !memberIds.includes(a.medewerkerId)
            )
          }
        };
      } else {
        // Add team selection (remove individual members if they were selected)
        return {
          ...prev,
          algemeen: {
            ...prev.algemeen,
            teamAllocaties: [
              ...prev.algemeen.teamAllocaties,
              {
                teamName,
                aantalDagen: 5,
                planningType: '',
                toelichting: ''
              }
            ],
            medewerkerAllocaties: prev.algemeen.medewerkerAllocaties.filter(
              a => !memberIds.includes(a.medewerkerId)
            )
          }
        };
      }
    });
  };

  const handleTeamDagenChange = (teamName: string, dagen: number) => {
    setFormData(prev => ({
      ...prev,
      algemeen: {
        ...prev.algemeen,
        teamAllocaties: prev.algemeen.teamAllocaties.map(t =>
          t.teamName === teamName ? { ...t, aantalDagen: dagen } : t
        )
      }
    }));
  };

  const handleTeamPlanningTypeChange = (teamName: string, planningType: 'samen_met_team' | 'beide') => {
    setFormData(prev => ({
      ...prev,
      algemeen: {
        ...prev.algemeen,
        teamAllocaties: prev.algemeen.teamAllocaties.map(t =>
          t.teamName === teamName ? { ...t, planningType } : t
        )
      }
    }));
  };

  const handleTeamToelichtingChange = (teamName: string, toelichting: string) => {
    setFormData(prev => ({
      ...prev,
      algemeen: {
        ...prev.algemeen,
        teamAllocaties: prev.algemeen.teamAllocaties.map(t =>
          t.teamName === teamName ? { ...t, toelichting } : t
        )
      }
    }));
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
        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Project Informatie</h2>
          <div className="space-y-2">
            <Label className="text-sm">Projecttype *</Label>
            <RadioGroup
              value={formData.projectType}
              onValueChange={(value: ProjectType) => setFormData({ ...formData, projectType: value })}
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
        </div>

        {/* Algemeen Project Form */}
        {formData.projectType === 'algemeen' && (
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Planning</h2>

            <div className="space-y-2">
              <Label className="text-sm">Startdatum (optioneel)</Label>
              <Input
                type="date"
                value={formData.algemeen.startDatum}
                onChange={(e) => setFormData({
                  ...formData,
                  algemeen: { ...formData.algemeen, startDatum: e.target.value }
                })}
              />
              <p className="text-xs text-muted-foreground">
                Laat leeg voor automatische planning door Ellen
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Betrokken medewerkers *</Label>
              <p className="text-xs text-muted-foreground">
                Selecteer wie er nodig is voor dit project
              </p>
              <div className="space-y-3 mt-3">
                {(() => {
                  // Group employees by duo_team
                  const teamGroups: Record<string, typeof employees> = {};
                  const individualEmployees: typeof employees = [];

                  employees.forEach(emp => {
                    if (emp.duoTeam) {
                      if (!teamGroups[emp.duoTeam]) teamGroups[emp.duoTeam] = [];
                      teamGroups[emp.duoTeam].push(emp);
                    } else {
                      individualEmployees.push(emp);
                    }
                  });

                  return (
                    <>
                      {/* Creative Teams */}
                      {Object.entries(teamGroups).map(([teamName, teamMembers]) => {
                        const teamAllocatie = formData.algemeen.teamAllocaties.find(t => t.teamName === teamName);
                        const isTeamSelected = !!teamAllocatie;
                        const memberIds = teamMembers.map(m => m.id);

                        return (
                          <div key={teamName} className="border border-border rounded-lg p-3 space-y-3">
                            {/* Team checkbox met namen eerst */}
                            <div className="space-y-3">
                              <div className="flex items-center gap-3">
                                <Checkbox
                                  id={`team-${teamName}`}
                                  checked={isTeamSelected}
                                  onCheckedChange={() => handleTeamToggle(teamName, memberIds)}
                                />
                                <Label htmlFor={`team-${teamName}`} className="text-sm font-medium cursor-pointer">
                                  {teamMembers.map(m => m.name).join(' & ')}
                                  <span className="text-muted-foreground font-normal ml-1">
                                    - {teamName}
                                  </span>
                                </Label>
                              </div>

                              {/* Team details - alleen tonen als geselecteerd */}
                              {isTeamSelected && teamAllocatie && (
                                <div className="pl-7 space-y-3">
                                  <div className="flex items-center gap-3">
                                    <Label className="text-sm whitespace-nowrap">Inspanning:</Label>
                                    <Select
                                      value={String(teamAllocatie.aantalDagen)}
                                      onValueChange={(v) => handleTeamDagenChange(teamName, parseFloat(v))}
                                    >
                                      <SelectTrigger className="w-32">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {DAGEN_OPTIES.map(o => (
                                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  <div className="space-y-2">
                                    <Label className="text-sm">Hoe plannen? *</Label>
                                    <Select
                                      value={teamAllocatie.planningType}
                                      onValueChange={(value: 'samen_met_team' | 'beide') =>
                                        handleTeamPlanningTypeChange(teamName, value)
                                      }
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Selecteer planning type" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="samen_met_team">
                                          Samen als team
                                        </SelectItem>
                                        <SelectItem value="beide">
                                          Beide (eerst samen, dan apart)
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  <div className="space-y-2">
                                    <Label className="text-sm">Toelichting</Label>
                                    <Textarea
                                      value={teamAllocatie.toelichting}
                                      onChange={(e) => handleTeamToelichtingChange(teamName, e.target.value)}
                                      placeholder="Waarom is dit team nodig? Wat gaan ze doen?"
                                      rows={2}
                                      className="text-sm"
                                    />
                                  </div>
                                </div>
                              )}

                              {/* Individual members - altijd tonen met border */}
                              <div className="pl-7 space-y-2 pt-2 border-t border-border">
                                {teamMembers.map(emp => {
                                  const allocatie = formData.algemeen.medewerkerAllocaties.find(a => a.medewerkerId === emp.id);
                                  const isSelected = !!allocatie;

                                  return (
                                    <div key={emp.id} className="space-y-2">
                                      <div className="flex items-center gap-3">
                                        <Checkbox
                                          id={`emp-${emp.id}`}
                                          checked={isSelected}
                                          onCheckedChange={() => handleMedewerkerToggle(emp.id)}
                                          disabled={isTeamSelected}
                                        />
                                        <Label htmlFor={`emp-${emp.id}`} className={`text-sm cursor-pointer ${isTeamSelected ? 'opacity-50' : ''}`}>
                                          {emp.name}
                                          <span className="text-muted-foreground ml-1">
                                            ({emp.role})
                                          </span>
                                          <span className="ml-1">- individueel</span>
                                        </Label>
                                      </div>

                                      {/* Individual details - alleen tonen als geselecteerd */}
                                      {isSelected && !isTeamSelected && allocatie && (
                                        <div className="pl-7 space-y-2">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <Label className="text-sm whitespace-nowrap">Inspanning:</Label>
                                            <Select
                                              value={allocatie.eenheid || 'dagen'}
                                              onValueChange={(v: 'dagen' | 'uren') => handleMedewerkerEenheidChange(emp.id, v)}
                                            >
                                              <SelectTrigger className="w-24">
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="dagen">Dagen</SelectItem>
                                                <SelectItem value="uren">Uren</SelectItem>
                                              </SelectContent>
                                            </Select>
                                            <Select
                                              value={String(allocatie.aantalDagen)}
                                              onValueChange={(v) => handleMedewerkerDagenChange(emp.id, parseFloat(v))}
                                            >
                                              <SelectTrigger className="w-36">
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent>
                                                {((allocatie.eenheid || 'dagen') === 'dagen' ? DAGEN_OPTIES : UREN_OPTIES).map(o => (
                                                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          </div>

                                          <div className="space-y-2">
                                            <Label className="text-sm">Toelichting</Label>
                                            <Textarea
                                              value={allocatie.toelichting}
                                              onChange={(e) => handleMedewerkerToelichtingChange(emp.id, e.target.value)}
                                              placeholder="Bijv. '4 uur per dag, 2 dagen' of 'Waarom nodig?'"
                                              rows={2}
                                              className="text-sm"
                                            />
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Overige medewerkers - geen header, gewoon onder elkaar */}
                      {individualEmployees.map(emp => {
                        const allocatie = formData.algemeen.medewerkerAllocaties.find(a => a.medewerkerId === emp.id);
                        const isSelected = !!allocatie;

                        return (
                          <div key={emp.id} className="border border-border rounded-lg p-3 space-y-3">
                            <div className="flex items-center gap-3">
                              <Checkbox
                                id={`emp-${emp.id}`}
                                checked={isSelected}
                                onCheckedChange={() => handleMedewerkerToggle(emp.id)}
                              />
                              <Label htmlFor={`emp-${emp.id}`} className="text-sm font-medium cursor-pointer">
                                {emp.name}
                                <span className="text-muted-foreground font-normal ml-1">
                                  ({emp.role})
                                </span>
                              </Label>
                            </div>

                            {/* Details - alleen tonen als geselecteerd */}
                            {isSelected && allocatie && (
                              <div className="pl-7 space-y-3">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Label className="text-sm whitespace-nowrap">Inspanning:</Label>
                                  <Select
                                    value={allocatie.eenheid || 'dagen'}
                                    onValueChange={(v: 'dagen' | 'uren') => handleMedewerkerEenheidChange(emp.id, v)}
                                  >
                                    <SelectTrigger className="w-24">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="dagen">Dagen</SelectItem>
                                      <SelectItem value="uren">Uren</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <Select
                                    value={String(allocatie.aantalDagen)}
                                    onValueChange={(v) => handleMedewerkerDagenChange(emp.id, parseFloat(v))}
                                  >
                                    <SelectTrigger className="w-36">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {((allocatie.eenheid || 'dagen') === 'dagen' ? DAGEN_OPTIES : UREN_OPTIES).map(o => (
                                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="space-y-2">
                                  <Label className="text-sm">Toelichting</Label>
                                  <Textarea
                                    value={allocatie.toelichting}
                                    onChange={(e) => handleMedewerkerToelichtingChange(emp.id, e.target.value)}
                                    placeholder="Bijv. '4 uur per dag, 2 dagen' of 'Waarom nodig?'"
                                    rows={2}
                                    className="text-sm"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </>
                  );
                })()}
              </div>
              {errors.algemeen && (
                <p className="text-xs text-destructive mt-1">{errors.algemeen}</p>
              )}
              {errors.aantalDagen && (
                <p className="text-xs text-destructive mt-1">{errors.aantalDagen}</p>
              )}
              {errors.planningType && (
                <p className="text-xs text-destructive mt-1">{errors.planningType}</p>
              )}
            </div>
          </div>
        )}

        {/* Productie Project Form */}
        {formData.projectType === 'productie' && (
          <>
            <BetrokkenTeam
              data={formData.betrokkenTeam}
              onChange={(data) => setFormData({ ...formData, betrokkenTeam: data })}
              showEllenToggle={true}
              ellenDefaultOn={false}
            />
            <ProductieFases
              data={formData.productieFases}
              onChange={(data) => setFormData({ ...formData, productieFases: data })}
            />
          </>
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
