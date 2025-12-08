import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WijzigingsverzoekForm, WijzigingsverzoekFormData } from '@/components/forms/WijzigingsverzoekForm';
import { toast } from '@/hooks/use-toast';

const STORAGE_KEY = 'concept_wijzigingsverzoek';

const emptyFormData: WijzigingsverzoekFormData = {
  klant: '',
  projectnaam: '',
  wijzigingType: '',
  beschrijving: '',
  deadline: '',
  medewerkers: [],
  opmerkingen: '',
};

export default function Wijzigingsverzoek() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<WijzigingsverzoekFormData>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : emptyFormData;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
  }, [formData]);

  const handleSaveConcept = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
    toast({
      title: 'Concept opgeslagen',
      description: 'Je kunt later verder werken aan dit verzoek.',
    });
  };

  const handleSubmit = async () => {
    if (!formData.klant || !formData.projectnaam || !formData.wijzigingType || !formData.beschrijving) {
      toast({
        title: 'Vul alle verplichte velden in',
        description: 'Klant, project, type wijziging en beschrijving zijn verplicht.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Verzoek wordt ingediend...',
      description: 'Even geduld alstublieft.',
    });

    await new Promise((resolve) => setTimeout(resolve, 1500));
    localStorage.removeItem(STORAGE_KEY);

    // Navigate to Ellen working page with form data
    navigate('/ellen-working', { 
      state: { 
        requestType: 'wijziging',
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
      <div className="max-w-3xl mx-auto px-6 pb-8">
        <h1 className="text-2xl font-semibold text-foreground mb-6">Wijzigingsverzoek</h1>
        <WijzigingsverzoekForm data={formData} onChange={setFormData} />
      </div>

      {/* Fixed bottom-right buttons */}
      <div className="fixed bottom-4 right-4 flex gap-2">
        <Button variant="ghost" onClick={handleSaveConcept}>
          <Save className="mr-2 h-4 w-4" />
          Opslaan als concept
        </Button>
        <Button onClick={handleSubmit}>
          Verzoek indienen
        </Button>
      </div>
    </div>
  );
}
