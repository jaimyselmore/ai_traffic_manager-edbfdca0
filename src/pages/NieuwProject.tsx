import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProjectForm, ProjectFormData } from '@/components/forms/ProjectForm';
import { toast } from '@/hooks/use-toast';

const STORAGE_KEY = 'concept_nieuw_project';

const emptyFormData: ProjectFormData = {
  klant: '',
  projectnaam: '',
  projectType: '',
  deliverables: '',
  deadline: '',
  deadlineOnbekend: false,
  indicatievePeriode: '',
  geschatteEffortWaarde: '',
  geschatteEffortEenheid: 'uren',
  letEllenKiezen: false,
  medewerkers: [],
  prioriteit: 'Normaal',
  opmerkingen: '',
};

export default function NieuwProject() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<ProjectFormData>(() => {
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

    if (!formData.klant) {
      newErrors.klant = 'Selecteer een klant';
    }
    if (!formData.projectnaam) {
      newErrors.projectnaam = 'Voer een projectnaam in';
    }
    if (!formData.projectType) {
      newErrors.projectType = 'Selecteer een project type';
    }
    if (!formData.deliverables) {
      newErrors.deliverables = 'Voer deliverables in';
    }
    if (!formData.deadlineOnbekend && !formData.deadline) {
      newErrors.deadline = 'Selecteer een deadline of markeer als onbekend';
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

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Clear localStorage after successful submit
    localStorage.removeItem(STORAGE_KEY);

    // Navigate to Ellen conversation page with form data
    navigate('/ellen-session', { 
      state: { 
        requestType: 'project',
        formData: formData
      } 
    });
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      {/* Top: back link on its own row, far left */}
      <div className="w-full px-6 pt-6 mb-4">
        <button
          type="button"
          className="text-sm text-muted-foreground hover:text-foreground"
          onClick={() => navigate('/')}
        >
          ← Terug naar overzicht
        </button>
      </div>

      {/* Form container with title */}
      <div className="max-w-3xl mx-auto px-6 pb-24">
        <h1 className="text-2xl font-semibold text-foreground mb-6">Nieuw project</h1>
        <ProjectForm data={formData} onChange={setFormData} errors={errors} />
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
