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

const STORAGE_KEY = 'concept_nieuw_project';

type ProjectType = 'nieuw_project' | 'algemeen' | 'productie' | 'guiding_idea' | '';
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

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.projectHeader.klantId) {
      newErrors.klantId = 'Selecteer een klant';
    }
    if (!formData.projectHeader.projectVolgnummer) {
      newErrors.projectVolgnummer = 'Voer een volgnummer in';
    }
    if (!formData.projectHeader.projectomschrijving) {
      newErrors.projectomschrijving = 'Voer een projectomschrijving in';
    }
    if (!formData.projectType) {
      newErrors.projectType = 'Selecteer eerst een projecttype.';
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

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast({
        title: 'Vul alle verplichte velden in',
        description: 'Controleer de gemarkeerde velden.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Plan wordt ingediend...',
      description: 'Even geduld alstublieft.',
    });

    await new Promise((resolve) => setTimeout(resolve, 1500));
    localStorage.removeItem(STORAGE_KEY);

    navigate('/ellen-session', {
      state: {
        requestType: formData.projectType === 'productie' ? 'productie' : 
                     formData.projectType === 'guiding_idea' ? 'guiding_idea' : 'project',
        formData: {
          ...formData,
          project_id_volledig: formData.projectHeader.volledigProjectId,
          project_type: formData.projectType,
          plan_status: 'concept',
        },
      },
    });
  };

  const getPageTitle = () => {
    switch (formData.projectType) {
      case 'productie': return 'Nieuw project – Productie';
      case 'guiding_idea': return 'Nieuw project – Guiding Idea';
      case 'nieuw_project': return 'Nieuw project';
      case 'algemeen': return 'Nieuw project – Algemeen';
      default: return 'Nieuw project';
    }
  };

  // Only require saveAsType when projectType is selected
  const isSubmitDisabled = !formData.projectType || (formData.projectType && !formData.saveAsType);

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
                <SelectItem value="algemeen">Algemeen project</SelectItem>
                <SelectItem value="guiding_idea">Guiding Idea</SelectItem>
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
