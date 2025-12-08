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

    toast({
      title: 'Wijzigingsverzoek ingediend',
      description: 'Je verzoek is succesvol ingediend en wordt verwerkt.',
    });

    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex flex-col gap-4 mb-8">
          <button
            type="button"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground self-start"
            onClick={() => navigate('/')}
          >
            ← Terug naar overzicht
          </button>
          <h1 className="text-2xl font-semibold text-foreground">Wijzigingsverzoek</h1>
        </div>

        <WijzigingsverzoekForm data={formData} onChange={setFormData} />

        <div className="flex justify-end gap-4 mt-10 pt-6 border-t border-border">
          <Button variant="outline" onClick={handleSaveConcept}>
            <Save className="mr-2 h-4 w-4" />
            Opslaan als concept
          </Button>
          <Button onClick={handleSubmit}>
            Verzoek indienen
          </Button>
        </div>
      </div>
    </div>
  );
}
