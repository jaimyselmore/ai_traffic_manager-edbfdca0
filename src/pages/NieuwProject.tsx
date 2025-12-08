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
  deliverables: '',
  deadline: '',
  medewerkers: [],
  opmerkingen: '',
};

export default function NieuwProject() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<ProjectFormData>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : emptyFormData;
  });

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

  const handleSubmit = async () => {
    // Validate required fields
    if (!formData.klant || !formData.projectnaam || !formData.deliverables || !formData.deadline) {
      toast({
        title: 'Vul alle verplichte velden in',
        description: 'Klant, projectnaam, deliverables en deadline zijn verplicht.',
        variant: 'destructive',
      });
      return;
    }

    // Mock API call
    toast({
      title: 'Plan wordt ingediend...',
      description: 'Even geduld alstublieft.',
    });

    // Simulate API call: POST /api/plan/submit
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Clear localStorage after successful submit
    localStorage.removeItem(STORAGE_KEY);

    // Navigate to Ellen working page
    navigate('/ellen-working', { state: { requestType: 'project' } });
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      {/* Back link - absolute top-left */}
      <div className="px-6 pt-6">
        <button
          type="button"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          onClick={() => navigate('/')}
        >
          ← Terug naar overzicht
        </button>
      </div>

      {/* Main content */}
      <div className="max-w-3xl mx-auto px-6 py-6 pb-12">
        <h1 className="text-2xl font-semibold text-foreground mb-8">Nieuw project</h1>

        {/* Form */}
        <ProjectForm data={formData} onChange={setFormData} />

        {/* Action buttons - right aligned */}
        <div className="mt-10 flex justify-end gap-3">
          <Button variant="outline" onClick={handleSaveConcept}>
            <Save className="mr-2 h-4 w-4" />
            Opslaan als concept
          </Button>
          <Button onClick={handleSubmit}>
            Plan indienen
          </Button>
        </div>
      </div>
    </div>
  );
}
