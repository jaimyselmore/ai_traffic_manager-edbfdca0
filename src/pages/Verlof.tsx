import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VerlofForm, VerlofFormData } from '@/components/forms/VerlofForm';
import { toast } from '@/hooks/use-toast';

const STORAGE_KEY = 'concept_verlof';

const emptyFormData: VerlofFormData = {
  medewerker: '',
  verlofType: '',
  verlofCategorie: '',
  startdatum: '',
  einddatum: '',
  backupPersoon: undefined,
  reden: '',
};

export default function Verlof() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<VerlofFormData>(() => {
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
    if (!formData.medewerker || !formData.verlofType || !formData.verlofCategorie || !formData.startdatum || !formData.einddatum) {
      toast({
        title: 'Vul alle verplichte velden in',
        description: 'Medewerker, type, categorie, startdatum en einddatum zijn verplicht.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Verlof wordt aangevraagd...',
      description: 'Even geduld alstublieft.',
    });

    await new Promise((resolve) => setTimeout(resolve, 1500));
    localStorage.removeItem(STORAGE_KEY);

    // Navigate to Ellen voorstel page with form data
    navigate('/ellen-voorstel', {
      state: {
        requestType: 'verlof',
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
        <h1 className="text-2xl font-semibold text-foreground mb-6">Beschikbaarheid medewerker</h1>
        <VerlofForm data={formData} onChange={setFormData} />
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
