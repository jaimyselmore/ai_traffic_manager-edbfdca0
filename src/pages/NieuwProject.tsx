import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
}

interface AlgemeenProjectData {
  medewerkerAllocaties: MedewerkerAllocatie[];
  planningMode: 'team' | 'individueel' | '';
  startDatum: string;
}

const emptyAlgemeenData: AlgemeenProjectData = {
  medewerkerAllocaties: [],
  planningMode: '',
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

  const [formData, setFormData] = useState<NieuwProjectFormData>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...emptyFormData, ...parsed };
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

      // Check if there are creative team members selected
      const selectedEmployeesWithTeam = formData.algemeen.medewerkerAllocaties
        .map(allocatie => employees.find(emp => emp.id === allocatie.medewerkerId))
        .filter(emp => emp && emp.duoTeam);

      const hasCreativeTeamMembers = selectedEmployeesWithTeam.length > 0;

      // Only validate planningMode if there are creative team members
      if (hasCreativeTeamMembers && !formData.algemeen.planningMode) {
        newErrors.planningMode = 'Selecteer een planning modus voor creative teams';
      }

      // Check if all selected employees have days > 0
      const invalidAllocaties = formData.algemeen.medewerkerAllocaties.filter(a => a.aantalDagen <= 0);
      if (invalidAllocaties.length > 0) {
        newErrors.aantalDagen = 'Alle medewerkers moeten minimaal 1 dag hebben';
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

      // Check if there are creative team members selected
      const selectedEmployeesWithTeam = formData.algemeen.medewerkerAllocaties
        .map(allocatie => employees.find(emp => emp.id === allocatie.medewerkerId))
        .filter(emp => emp && emp.duoTeam);

      const hasCreativeTeamMembers = selectedEmployeesWithTeam.length > 0;

      // Only require planningMode if there are creative team members
      if (hasCreativeTeamMembers && !formData.algemeen.planningMode) {
        missing.push('Planning modus');
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
      // Check if there are creative team members selected
      const selectedEmployeesWithTeam = formData.algemeen.medewerkerAllocaties
        .map(allocatie => employees.find(emp => emp.id === allocatie.medewerkerId))
        .filter(emp => emp && emp.duoTeam);

      const hasCreativeTeamMembers = selectedEmployeesWithTeam.length > 0;

      // Only use team planning if there are creative team members AND team mode is selected
      // Otherwise, always plan individually
      const effectivePlanningMode = hasCreativeTeamMembers && formData.algemeen.planningMode === 'team'
        ? 'team'
        : 'individueel';

      // For algemeen: create fases based on effective planning mode
      if (effectivePlanningMode === 'team') {
        // Plan as team: one fase with all employees
        const allMedewerkers = formData.algemeen.medewerkerAllocaties.map(a => a.medewerkerId);
        // Use the maximum days from allocations for team planning
        const maxDagen = Math.max(...formData.algemeen.medewerkerAllocaties.map(a => a.aantalDagen));
        fases.push({
          fase_naam: 'Algemeen (Creative Team)',
          medewerkers: allMedewerkers,
          start_datum: formData.algemeen.startDatum || formData.projectHeader.datumAanvraag || new Date().toISOString().split('T')[0],
          duur_dagen: maxDagen,
          uren_per_dag: 8
        });
      } else {
        // Plan individually: separate fase for each employee
        formData.algemeen.medewerkerAllocaties.forEach(allocatie => {
          const employee = employees.find(e => e.id === allocatie.medewerkerId);
          fases.push({
            fase_naam: `Algemeen - ${employee?.name || 'Medewerker'}`,
            medewerkers: [allocatie.medewerkerId],
            start_datum: formData.algemeen.startDatum || formData.projectHeader.datumAanvraag || new Date().toISOString().split('T')[0],
            duur_dagen: allocatie.aantalDagen,
            uren_per_dag: 8
          });
        });
      }
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
      if (!formData.algemeen.planningMode) return false;
      // Check if all allocations have valid days
      if (formData.algemeen.medewerkerAllocaties.some(a => a.aantalDagen <= 0)) return false;
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
        // Add employee with default 5 days
        return {
          ...prev,
          algemeen: {
            ...prev.algemeen,
            medewerkerAllocaties: [
              ...prev.algemeen.medewerkerAllocaties,
              { medewerkerId: id, aantalDagen: 5 }
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
        {formData.projectType === 'algemeen' && (() => {
          // Check if any selected employees are part of a creative team (duo_team)
          const selectedEmployeesWithTeam = formData.algemeen.medewerkerAllocaties
            .map(allocatie => employees.find(emp => emp.id === allocatie.medewerkerId))
            .filter(emp => emp && emp.duoTeam);

          const hasCreativeTeamMembers = selectedEmployeesWithTeam.length > 0;

          return (
            <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Planning</h2>

              {hasCreativeTeamMembers && (
                <div className="space-y-2">
                  <Label className="text-sm">Planning modus voor creative teams *</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Je hebt creative team members geselecteerd. Kies hoe ze ingepland moeten worden.
                  </p>
                  <RadioGroup
                    value={formData.algemeen.planningMode}
                    onValueChange={(value: 'team' | 'individueel') => setFormData({
                      ...formData,
                      algemeen: { ...formData.algemeen, planningMode: value }
                    })}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="team" id="team" />
                      <Label htmlFor="team" className="text-sm font-normal cursor-pointer">
                        Plan creative teams samen (als één blok in de planner)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="individueel" id="individueel" />
                      <Label htmlFor="individueel" className="text-sm font-normal cursor-pointer">
                        Plan iedereen individueel (aparte blokken per medewerker)
                      </Label>
                    </div>
                  </RadioGroup>
                  {errors.planningMode && (
                    <p className="text-xs text-destructive mt-1">{errors.planningMode}</p>
                  )}
                </div>
              )}

              {!hasCreativeTeamMembers && formData.algemeen.medewerkerAllocaties.length > 0 && (
                <div className="p-3 bg-secondary/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Alle medewerkers worden individueel ingepland (geen creative teams geselecteerd)
                  </p>
                </div>
              )}

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
                Selecteer medewerkers en geef per persoon aan hoeveel dagen ze nodig zijn
              </p>
              <div className="space-y-3 mt-3">
                {(employees || []).map((emp) => {
                  const allocatie = formData.algemeen.medewerkerAllocaties.find(a => a.medewerkerId === emp.id);
                  const isSelected = !!allocatie;

                  return (
                    <div key={emp.id} className="flex items-center gap-3 p-3 border border-border rounded-lg">
                      <Checkbox
                        id={`emp-${emp.id}`}
                        checked={isSelected}
                        onCheckedChange={() => handleMedewerkerToggle(emp.id)}
                      />
                      <Label htmlFor={`emp-${emp.id}`} className="flex-1 text-sm cursor-pointer">
                        {emp.name}
                        <span className="text-muted-foreground ml-1 text-xs">({emp.role})</span>
                      </Label>
                      {isSelected && allocatie && (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="1"
                            value={allocatie.aantalDagen}
                            onChange={(e) => handleMedewerkerDagenChange(emp.id, parseInt(e.target.value) || 1)}
                            className="w-20"
                          />
                          <span className="text-sm text-muted-foreground">dagen</span>
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
            </div>
          </div>
          );
        })()}

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
