import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProjectHeader, ProjectHeaderData, emptyProjectHeaderData } from '@/components/forms/ProjectHeader';
import { BetrokkenTeam, BetrokkenTeamData, emptyBetrokkenTeamData } from '@/components/forms/BetrokkenTeam';
import { ProductieFases, ProductieFasesData, emptyProductieFasesData } from '@/components/forms/ProductieFases';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { createProjectAndSchedule } from '@/lib/services/planningAutomation';
import { useClients } from '@/hooks/use-clients';

const STORAGE_KEY = 'concept_nieuw_project';

interface NieuwProjectFormData {
  projectHeader: ProjectHeaderData;
  betrokkenTeam: BetrokkenTeamData;
  productieFases: ProductieFasesData;
}

const emptyFormData: NieuwProjectFormData = {
  projectHeader: emptyProjectHeaderData,
  betrokkenTeam: emptyBetrokkenTeamData,
  productieFases: emptyProductieFasesData,
};

export default function NieuwProject() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: clients = [] } = useClients();

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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const getMissingFieldsMessage = (): string => {
    const missing: string[] = [];
    if (!formData.projectHeader.klantId) missing.push('Klant');
    if (!formData.projectHeader.projectomschrijving) missing.push('Projectomschrijving');
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

    // Build fases array from productie fases
    const fases: any[] = [];
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
        projecttype: 'productie',
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
          <h1 className="text-2xl font-semibold text-foreground">Nieuw project – Productie</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Maak een nieuw productieproject aan in de planning met klant, team en fases.
          </p>
        </div>

        {/* Shared Project Header */}
        <ProjectHeader
          data={formData.projectHeader}
          onChange={(data) => setFormData({ ...formData, projectHeader: data })}
          errors={errors}
        />

        {/* Productie-specific sections */}
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
