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
  startdatum: '',
  einddatum: '',
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
    if (!formData.medewerker || !formData.verlofType || !formData.startdatum || !formData.einddatum) {
      toast({
        title: 'Vul alle verplichte velden in',
        description: 'Medewerker, type, startdatum en einddatum zijn verplicht.',
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

    // Navigate to Ellen working page
    navigate('/ellen-working', { state: { requestType: 'verlof' } });
  };

  return (
    <div className="min-h-screen bg-background">
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
      <div className="max-w-3xl mx-auto px-6 py-6">
        <h1 className="text-2xl font-semibold text-foreground mb-8">Beschikbaarheid medewerker</h1>

        <VerlofForm data={formData} onChange={setFormData} />

        {/* Action buttons - right aligned */}
        <div className="mt-10 flex justify-end gap-3">
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
