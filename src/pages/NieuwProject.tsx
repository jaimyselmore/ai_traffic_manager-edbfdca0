import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ProjectHeader, ProjectHeaderData, emptyProjectHeaderData } from '@/components/forms/ProjectHeader';
import { BetrokkenTeam, BetrokkenTeamData, emptyBetrokkenTeamData } from '@/components/forms/BetrokkenTeam';
import { ProductieFases, ProductieFasesData, emptyProductieFasesData } from '@/components/forms/ProductieFases';
import { PlanningModeForm, PlanningModeData, emptyPlanningModeData } from '@/components/forms/PlanningModeForm';
import { toast } from '@/hooks/use-toast';

const STORAGE_KEY = 'concept_nieuw_project';

type ProjectType = 'algemeen' | 'productie' | 'guiding_idea' | '';

interface NieuwProjectFormData {
  projectHeader: ProjectHeaderData;
  projectType: ProjectType;
  betrokkenTeam: BetrokkenTeamData;
  productieFases: ProductieFasesData;
  planningMode: PlanningModeData;
}

const emptyFormData: NieuwProjectFormData = {
  projectHeader: emptyProjectHeaderData,
  projectType: '',
  betrokkenTeam: emptyBetrokkenTeamData,
  productieFases: emptyProductieFasesData,
  planningMode: emptyPlanningModeData,
};

export default function NieuwProject() {
  const navigate = useNavigate();

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
    if (!formData.projectHeader.projectVolgnummer) {
      newErrors.projectVolgnummer = 'Voer een volgnummer in';
    }
    if (!formData.projectHeader.projectomschrijving) {
      newErrors.projectomschrijving = 'Voer een projectomschrijving in';
    }
    if (!formData.projectType) {
      newErrors.projectType = 'Selecteer een projecttype';
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
      default: return 'Nieuw project';
    }
  };

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
              value={formData.projectType}
              onValueChange={(value) => setFormData({ ...formData, projectType: value as ProjectType })}
            >
              <SelectTrigger className={errors.projectType ? 'border-destructive' : ''}>
                <SelectValue placeholder="Kies een projecttype" />
              </SelectTrigger>
              <SelectContent>
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
        {formData.projectType === 'algemeen' && (
          <>
            <PlanningModeForm
              data={formData.planningMode}
              onChange={(data) => setFormData({ ...formData, planningMode: data })}
            />
            <BetrokkenTeam
              data={formData.betrokkenTeam}
              onChange={(data) => setFormData({ ...formData, betrokkenTeam: data })}
              showEllenToggle={false}
            />
          </>
        )}

        {formData.projectType === 'guiding_idea' && (
          <>
            <PlanningModeForm
              data={formData.planningMode}
              onChange={(data) => setFormData({ ...formData, planningMode: data })}
            />
            <BetrokkenTeam
              data={formData.betrokkenTeam}
              onChange={(data) => setFormData({ ...formData, betrokkenTeam: data })}
              showEllenToggle={false}
            />
          </>
        )}

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
        <Button onClick={handleSubmit}>
          Plan indienen
        </Button>
      </div>
    </div>
  );
}
