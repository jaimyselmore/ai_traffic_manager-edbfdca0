import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ProjectHeader, ProjectHeaderData, emptyProjectHeaderData } from '@/components/forms/ProjectHeader';
import { BetrokkenTeam, BetrokkenTeamData, emptyBetrokkenTeamData } from '@/components/forms/BetrokkenTeam';
import { ProductieFases, ProductieFasesData, emptyProductieFasesData } from '@/components/forms/ProductieFases';
import { PlanningModeForm, PlanningModeData, emptyPlanningModeData } from '@/components/forms/PlanningModeForm';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { createProjectAndSchedule } from '@/lib/services/planningAutomation';
import { useClients } from '@/lib/data';

const STORAGE_KEY = 'concept_nieuw_project';

type ProjectType = 'nieuw_project' | 'productie' | '';
type SaveAsType = 'alleen_project' | 'nieuw_type' | '';

interface NieuwProjectFormData {
  projectHeader: ProjectHeaderData;
  projectType: ProjectType;
  betrokkenTeam: BetrokkenTeamData;
  productieFases: ProductieFasesData;
  planningMode: PlanningModeData;
  saveAsType: SaveAsType;
  nieuwTypenaam: string;
  nieuwTypeOmschrijving: string;
}

const emptyFormData: NieuwProjectFormData = {
  projectHeader: emptyProjectHeaderData,
  projectType: '',
  betrokkenTeam: emptyBetrokkenTeamData,
  productieFases: emptyProductieFasesData,
  planningMode: emptyPlanningModeData,
  saveAsType: '',
  nieuwTypenaam: '',
  nieuwTypeOmschrijving: '',
};

export default function NieuwProject() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: clients = [] } = useClients();

  const [formData, setFormData] = useState<NieuwProjectFormData>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Always reset projectType to empty on page load
      return { ...emptyFormData, ...parsed, projectType: '' as ProjectType, saveAsType: '' as SaveAsType };
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

  const hasAtLeastOnePhase = () => {
    return (
      formData.planningMode.conceptontwikkeling.enabled ||
      formData.planningMode.conceptuitwerking.enabled ||
      formData.planningMode.presentatiesEnabled
    );
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
      newErrors.projectType = 'Selecteer eerst een projecttype.';
    }
    // For nieuw_project type, require at least one phase
    if (formData.projectType === 'nieuw_project' && !hasAtLeastOnePhase()) {
      newErrors.phases = 'Selecteer minimaal één fase (Conceptontwikkeling, Conceptuitwerking of Presentatie/meetingmomenten).';
    }
    // Only validate saveAsType if projectType is selected (since it's hidden otherwise)
    if (formData.projectType && !formData.saveAsType) {
      newErrors.saveAsType = 'Kies hoe je deze instellingen wilt gebruiken.';
    }
    if (formData.saveAsType === 'nieuw_type' && !formData.nieuwTypenaam) {
      newErrors.nieuwTypenaam = 'Voer een naam in voor het projecttype';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const getMissingFieldsMessage = (): string => {
    const missing: string[] = [];
    if (!formData.projectHeader.klantId) missing.push('Klant');
    if (!formData.projectType) missing.push('Projecttype');
    if (!formData.projectHeader.projectomschrijving) missing.push('Projectomschrijving');
    if (formData.projectType === 'nieuw_project' && !hasAtLeastOnePhase()) {
      missing.push('minimaal één fase');
    }
    if (formData.projectType && !formData.saveAsType) missing.push('Opslagoptie');
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

    // Build fases array from form data
    const fases: any[] = [];

    // For productie type, use productie fases
    if (formData.projectType === 'productie') {
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
    } else if (formData.projectType === 'nieuw_project') {
      // For nieuw_project type, use planning mode fases
      if (formData.planningMode.conceptontwikkeling.enabled) {
        // Extract employee names from MedewerkerEffort objects
        const medewerkers = formData.planningMode.conceptontwikkeling.medewerkers.map(m => m.medewerkerNaam);

        fases.push({
          fase_naam: 'Conceptontwikkeling',
          medewerkers: medewerkers,
          start_datum: formData.projectHeader.datumAanvraag || new Date().toISOString().split('T')[0],
          duur_dagen: formData.planningMode.conceptontwikkeling.inspanning || 2,
          uren_per_dag: 6
        });
      }
      if (formData.planningMode.conceptuitwerking.enabled) {
        // Extract employee names from MedewerkerEffort objects
        const medewerkers = formData.planningMode.conceptuitwerking.medewerkers.map(m => m.medewerkerNaam);

        fases.push({
          fase_naam: 'Conceptuitwerking',
          medewerkers: medewerkers,
          start_datum: formData.projectHeader.datumAanvraag || new Date().toISOString().split('T')[0],
          duur_dagen: formData.planningMode.conceptuitwerking.inspanning || 2,
          uren_per_dag: 6
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

  const getPageTitle = () => {
    switch (formData.projectType) {
      case 'productie': return 'Nieuw project – Productie';
      case 'nieuw_project': return 'Nieuw project';
      default: return 'Nieuw project';
    }
  };

  // Check all required fields for enabling submit button
  const canSubmit = () => {
    if (!formData.projectHeader.klantId) return false;
    if (!formData.projectType) return false;
    if (!formData.projectHeader.projectomschrijving) return false;
    if (formData.projectType === 'nieuw_project' && !hasAtLeastOnePhase()) return false;
    if (!formData.saveAsType) return false;
    if (formData.saveAsType === 'nieuw_type' && !formData.nieuwTypenaam) return false;
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
          <h1 className="text-2xl font-semibold text-foreground">{getPageTitle()}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Maak een nieuw project aan in de planning met klant, team en globale timing.
          </p>
        </div>

        {/* Shared Project Header */}
        <ProjectHeader
          data={formData.projectHeader}
          onChange={(data) => setFormData({ ...formData, projectHeader: data })}
          errors={errors}
        />

        {/* Projecttype selector */}
        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Projecttype</h2>
          <div>
            <Label className="text-sm">Selecteer projecttype *</Label>
            <Select
              value={formData.projectType || undefined}
              onValueChange={(value) => setFormData({ ...formData, projectType: value as ProjectType })}
            >
              <SelectTrigger className={errors.projectType ? 'border-destructive' : ''}>
                <SelectValue placeholder="Selecteer projecttype…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nieuw_project">Nieuw project</SelectItem>
                <SelectItem value="productie">Productie</SelectItem>
              </SelectContent>
            </Select>
            {errors.projectType && (
              <p className="text-xs text-destructive mt-1">{errors.projectType}</p>
            )}
          </div>
        </div>

        {/* Conditional sections based on project type */}
        {formData.projectType && (
          <>
            {/* Planning mode - show for all except productie which has its own flow */}
            {formData.projectType !== 'productie' && (
              <PlanningModeForm
                data={formData.planningMode}
                onChange={(data) => setFormData({ ...formData, planningMode: data })}
              />
            )}

            {/* Betrokken team - show for all types */}
            <BetrokkenTeam
              data={formData.betrokkenTeam}
              onChange={(data) => setFormData({ ...formData, betrokkenTeam: data })}
              showEllenToggle={formData.projectType === 'productie'}
              ellenDefaultOn={false}
            />

            {/* Productie-specific phases */}
            {formData.projectType === 'productie' && (
              <ProductieFases
                data={formData.productieFases}
                onChange={(data) => setFormData({ ...formData, productieFases: data })}
              />
            )}
          </>
        )}

        {/* Opslaan als projecttype section - only show when projectType is selected */}
        {formData.projectType && (
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Kies hoe je deze instellingen wilt gebruiken</h2>
            
            <RadioGroup
              value={formData.saveAsType}
              onValueChange={(value) => setFormData({ ...formData, saveAsType: value as SaveAsType })}
              className="space-y-3"
            >
              <label 
                htmlFor="save-alleen"
                className={`flex items-start gap-3 p-4 rounded-lg border ${
                  formData.saveAsType === 'alleen_project' ? 'border-primary bg-primary/5' : 'border-border'
                } hover:bg-secondary/50 cursor-pointer`}
              >
                <RadioGroupItem value="alleen_project" id="save-alleen" className="mt-1" />
                <div className="flex-1">
                  <span className="font-medium text-foreground">
                    Alleen gebruiken voor dit project
                  </span>
                  <p className="text-sm text-muted-foreground mt-1">
                    De instellingen gelden alleen voor dit ene project.
                  </p>
                </div>
              </label>
              
              <label 
                htmlFor="save-type"
                className={`flex items-start gap-3 p-4 rounded-lg border ${
                  formData.saveAsType === 'nieuw_type' ? 'border-primary bg-primary/5' : 'border-border'
                } hover:bg-secondary/50 cursor-pointer`}
              >
                <RadioGroupItem value="nieuw_type" id="save-type" className="mt-1" />
                <div className="flex-1">
                  <span className="font-medium text-foreground">
                    Opslaan als nieuw projecttype
                  </span>
                  <p className="text-sm text-muted-foreground mt-1">
                    Sla deze instellingen op zodat je dit type project later opnieuw kunt kiezen.
                  </p>
                </div>
              </label>
            </RadioGroup>

            {errors.saveAsType && (
              <p className="text-xs text-destructive">{errors.saveAsType}</p>
            )}

            {formData.saveAsType === 'nieuw_type' && (
              <div className="space-y-4 pt-4 border-t border-border">
                <div>
                  <Label className="text-sm">Naam projecttype *</Label>
                  <Input
                    value={formData.nieuwTypenaam}
                    onChange={(e) => setFormData({ ...formData, nieuwTypenaam: e.target.value })}
                    placeholder="bijv. Campagne, Rebrand, Social Content"
                    className={errors.nieuwTypenaam ? 'border-destructive' : ''}
                  />
                  {errors.nieuwTypenaam && (
                    <p className="text-xs text-destructive mt-1">{errors.nieuwTypenaam}</p>
                  )}
                </div>
                <div>
                  <Label className="text-sm">Korte omschrijving (optioneel)</Label>
                  <Textarea
                    value={formData.nieuwTypeOmschrijving}
                    onChange={(e) => setFormData({ ...formData, nieuwTypeOmschrijving: e.target.value })}
                    placeholder="Beschrijf wanneer dit projecttype gebruikt wordt..."
                    rows={2}
                  />
                </div>
              </div>
            )}
          </div>
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
