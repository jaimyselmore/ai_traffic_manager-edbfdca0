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
import { useAuth } from '@/contexts/AuthContext';
import { createProjectAndSchedule } from '@/lib/services/planningAutomation';
import { useClients } from '@/hooks/use-clients';
import { useEmployees } from '@/hooks/use-employees';

const STORAGE_KEY = 'concept_nieuw_project';

type ProjectType = 'algemeen' | 'productie' | '';

interface MedewerkerAllocatie {
  medewerkerId: string;
  aantalDagen: number;
  planningType: 'individueel' | 'samen_met_team' | 'beide' | ''; // Hoe deze medewerker moet worden ingepland
  toelichting: string; // Waarom deze medewerker nodig is en hoe
}

interface AlgemeenProjectData {
  medewerkerAllocaties: MedewerkerAllocatie[];
  startDatum: string;
}

const emptyAlgemeenData: AlgemeenProjectData = {
  medewerkerAllocaties: [],
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
    toast({
      title: 'Concept opgeslagen',
      description: 'Je kunt later verder werken aan dit project.',
    });
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
      if (formData.algemeen.medewerkerAllocaties.length === 0) {
        newErrors.algemeen = 'Selecteer minimaal één medewerker';
      }

      // Check if all selected employees have days > 0
      const invalidAllocaties = formData.algemeen.medewerkerAllocaties.filter(a => a.aantalDagen <= 0);
      if (invalidAllocaties.length > 0) {
        newErrors.aantalDagen = 'Alle medewerkers moeten minimaal 1 dag hebben';
      }

      // Check if creative team members have selected a planning type
      const creativeTeamMembersWithoutPlanningType = formData.algemeen.medewerkerAllocaties
        .filter(allocatie => {
          const emp = employees.find(e => e.id === allocatie.medewerkerId);
          return emp && emp.duoTeam && !allocatie.planningType;
        });

      if (creativeTeamMembersWithoutPlanningType.length > 0) {
        newErrors.planningType = 'Selecteer voor alle creative team members hoe ze moeten worden ingepland';
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
      if (formData.algemeen.medewerkerAllocaties.length === 0) missing.push('Medewerkers');

      // Check if creative team members have planning type selected
      const creativeTeamMembersWithoutPlanningType = formData.algemeen.medewerkerAllocaties
        .filter(allocatie => {
          const emp = employees.find(e => e.id === allocatie.medewerkerId);
          return emp && emp.duoTeam && !allocatie.planningType;
        });

      if (creativeTeamMembersWithoutPlanningType.length > 0) {
        missing.push('Planning type voor creative teams');
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

    toast({
      title: 'Project wordt aangemaakt...',
      description: 'Blokken worden geplaatst in de planner...',
    });

    // Find client name
    const selectedClient = clients.find(c => c.id === formData.projectHeader.klantId);
    const klantNaam = selectedClient?.name || 'Onbekend';

    // Build fases array based on project type
    const fases: any[] = [];

    if (formData.projectType === 'algemeen') {
      // Group allocaties by duo_team for team planning
      const teamGroups: Record<string, typeof formData.algemeen.medewerkerAllocaties> = {};
      const individueleAllocaties: typeof formData.algemeen.medewerkerAllocaties = [];

      formData.algemeen.medewerkerAllocaties.forEach(allocatie => {
        const employee = employees.find(e => e.id === allocatie.medewerkerId);
        const isCreativeTeam = employee && employee.duoTeam;

        // Handle "beide" case - add to both team and individual
        if (allocatie.planningType === 'beide') {
          // Add to team planning if part of creative team
          if (isCreativeTeam) {
            const teamKey = employee.duoTeam;
            if (!teamGroups[teamKey]) teamGroups[teamKey] = [];
            teamGroups[teamKey].push({ ...allocatie, aantalDagen: Math.floor(allocatie.aantalDagen / 2) });
          }
          // Also add to individual planning
          individueleAllocaties.push({ ...allocatie, aantalDagen: Math.ceil(allocatie.aantalDagen / 2) });
        }
        // Handle "samen_met_team" case
        else if (allocatie.planningType === 'samen_met_team' && isCreativeTeam) {
          const teamKey = employee.duoTeam;
          if (!teamGroups[teamKey]) teamGroups[teamKey] = [];
          teamGroups[teamKey].push(allocatie);
        }
        // Handle "individueel" case or no creative team
        else {
          individueleAllocaties.push(allocatie);
        }
      });

      // Create team fases (one per creative team)
      Object.entries(teamGroups).forEach(([teamName, allocaties]) => {
        const medewerkers = allocaties.map(a => a.medewerkerId);
        const maxDagen = Math.max(...allocaties.map(a => a.aantalDagen));
        // Get toelichtingen from allocaties
        const toelichtingen = allocaties
          .filter(a => a.toelichting)
          .map(a => {
            const emp = employees.find(e => e.id === a.medewerkerId);
            return `${emp?.name}: ${a.toelichting}`;
          })
          .join('; ');

        fases.push({
          fase_naam: `Algemeen (Team ${teamName})`,
          medewerkers,
          start_datum: formData.algemeen.startDatum || formData.projectHeader.datumAanvraag || new Date().toISOString().split('T')[0],
          duur_dagen: maxDagen,
          uren_per_dag: 8,
          notities: toelichtingen || undefined
        });
      });

      // Create individual fases
      individueleAllocaties.forEach(allocatie => {
        const employee = employees.find(e => e.id === allocatie.medewerkerId);
        fases.push({
          fase_naam: `Algemeen - ${employee?.name || 'Medewerker'}`,
          medewerkers: [allocatie.medewerkerId],
          start_datum: formData.algemeen.startDatum || formData.projectHeader.datumAanvraag || new Date().toISOString().split('T')[0],
          duur_dagen: allocatie.aantalDagen,
          uren_per_dag: 8,
          notities: allocatie.toelichting || undefined
        });
      });
    } else {
      // For productie: use productie fases
      const productieFases = formData.productieFases.fases;

    if (productieFases.pp?.enabled) {
      fases.push({
        fase_naam: 'PP',
        medewerkers: productieFases.pp.medewerkers || [],
        start_datum: productieFases.pp.startDatum || formData.projectHeader.datumAanvraag || new Date().toISOString().split('T')[0],
        duur_dagen: productieFases.pp.dagen || 2,
        uren_per_dag: 8
      });
    }
    if (productieFases.shoot?.enabled) {
      fases.push({
        fase_naam: 'Shoot',
        medewerkers: productieFases.shoot.medewerkers || [],
        start_datum: productieFases.shoot.startDatum || formData.projectHeader.datumAanvraag || new Date().toISOString().split('T')[0],
        duur_dagen: productieFases.shoot.dagen || 1,
        uren_per_dag: 8
      });
    }
    if (productieFases.offlineEdit?.enabled) {
      fases.push({
        fase_naam: 'Offline edit',
        medewerkers: productieFases.offlineEdit.medewerkers || [],
        start_datum: productieFases.offlineEdit.startDatum || formData.projectHeader.datumAanvraag || new Date().toISOString().split('T')[0],
        duur_dagen: productieFases.offlineEdit.dagen || 2,
        uren_per_dag: 8
      });
    }
    if (productieFases.onlineGrading?.enabled) {
      fases.push({
        fase_naam: 'Online/VFX',
        medewerkers: productieFases.onlineGrading.medewerkers || [],
        start_datum: productieFases.onlineGrading.startDatum || formData.projectHeader.datumAanvraag || new Date().toISOString().split('T')[0],
        duur_dagen: productieFases.onlineGrading.dagen || 2,
        uren_per_dag: 8
      });
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

    // Call automation service
    const result = await createProjectAndSchedule(
      {
        klant_id: formData.projectHeader.klantId,
        klant_naam: klantNaam,
        projectnaam: formData.projectHeader.projectomschrijving,
        projectTitel: formData.projectHeader.projectTitel,
        projecttype: formData.projectType,
        deadline: formData.projectHeader.deadline,
        fases
      },
      user.id
    );

    if (result.success) {
      localStorage.removeItem(STORAGE_KEY);

      toast({
        title: 'Project aangemaakt!',
        description: `${result.blokkenAantal} blokken zijn geplaatst in de planner`,
      });

      if (result.warnings && result.warnings.length > 0) {
        setTimeout(() => {
          toast({
            title: 'Let op',
            description: result.warnings!.join('\n'),
            variant: 'default',
          });
        }, 1000);
      }

      navigate('/planner');
    } else {
      toast({
        title: 'Fout bij aanmaken project',
        description: result.errors?.join('\n') || 'Er ging iets mis',
        variant: 'destructive',
      });
    }
  };

  // Check all required fields for enabling submit button
  const canSubmit = () => {
    if (!formData.projectHeader.klantId) return false;
    if (!formData.projectHeader.projectomschrijving) return false;
    if (!formData.projectType) return false;
    if (formData.projectType === 'algemeen') {
      if (formData.algemeen.medewerkerAllocaties.length === 0) return false;
      // Check if all allocations have valid days
      if (formData.algemeen.medewerkerAllocaties.some(a => a.aantalDagen <= 0)) return false;
      // Check if creative team members have planning type selected
      const creativeTeamMembersWithoutPlanningType = formData.algemeen.medewerkerAllocaties.some(allocatie => {
        const emp = employees.find(e => e.id === allocatie.medewerkerId);
        return emp && emp.duoTeam && !allocatie.planningType;
      });
      if (creativeTeamMembersWithoutPlanningType) return false;
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
                planningType: '',
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

  const handleMedewerkerPlanningTypeChange = (id: string, planningType: 'individueel' | 'samen_met_team' | 'beide') => {
    setFormData(prev => ({
      ...prev,
      algemeen: {
        ...prev.algemeen,
        medewerkerAllocaties: prev.algemeen.medewerkerAllocaties.map(a =>
          a.medewerkerId === id ? { ...a, planningType } : a
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
                Selecteer medewerkers en geef per persoon details over hun betrokkenheid
              </p>
              <div className="space-y-4 mt-3">
                {(employees || []).map((emp) => {
                  const allocatie = formData.algemeen.medewerkerAllocaties.find(a => a.medewerkerId === emp.id);
                  const isSelected = !!allocatie;
                  const isCreativeTeam = !!emp.duoTeam;

                  return (
                    <div key={emp.id} className="border border-border rounded-lg p-4 space-y-3">
                      {/* Medewerker selectie en naam */}
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id={`emp-${emp.id}`}
                          checked={isSelected}
                          onCheckedChange={() => handleMedewerkerToggle(emp.id)}
                        />
                        <Label htmlFor={`emp-${emp.id}`} className="flex-1 text-sm font-medium cursor-pointer">
                          {emp.name}
                          <span className="text-muted-foreground ml-1 text-xs">({emp.role})</span>
                          {isCreativeTeam && (
                            <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                              Creative Team: {emp.duoTeam}
                            </span>
                          )}
                        </Label>
                      </div>

                      {/* Details wanneer geselecteerd */}
                      {isSelected && allocatie && (
                        <div className="pl-7 space-y-3">
                          {/* Aantal dagen */}
                          <div className="flex items-center gap-3">
                            <Label className="text-sm w-24">Aantal dagen:</Label>
                            <Input
                              type="number"
                              min="1"
                              value={allocatie.aantalDagen}
                              onChange={(e) => handleMedewerkerDagenChange(emp.id, parseInt(e.target.value) || 1)}
                              className="w-20"
                            />
                            <span className="text-sm text-muted-foreground">dagen</span>
                          </div>

                          {/* Planning type - alleen voor creative team members */}
                          {isCreativeTeam && (
                            <div className="space-y-2">
                              <Label className="text-sm">Hoe plannen? *</Label>
                              <Select
                                value={allocatie.planningType}
                                onValueChange={(value: 'individueel' | 'samen_met_team' | 'beide') =>
                                  handleMedewerkerPlanningTypeChange(emp.id, value)
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecteer planning type" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="samen_met_team">
                                    Samen met creative team
                                  </SelectItem>
                                  <SelectItem value="individueel">
                                    Individueel (apart van team)
                                  </SelectItem>
                                  <SelectItem value="beide">
                                    Beide (eerst samen, dan apart)
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-muted-foreground">
                                Creative team members kunnen samen óf apart worden ingepland
                              </p>
                            </div>
                          )}

                          {/* Toelichting - voor iedereen */}
                          <div className="space-y-2">
                            <Label className="text-sm">Toelichting</Label>
                            <Textarea
                              value={allocatie.toelichting}
                              onChange={(e) => handleMedewerkerToelichtingChange(emp.id, e.target.value)}
                              placeholder="Waarom is deze medewerker nodig? Wat gaat diegene doen? Bijv: 'Eerst 2 dagen samen brainstormen, dan 3 dagen apart uitwerken'"
                              rows={3}
                              className="text-sm"
                            />
                            <p className="text-xs text-muted-foreground">
                              Dit helpt Ellen om beter te begrijpen hoe de planning moet worden ingericht
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
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
