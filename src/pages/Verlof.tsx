import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
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

    toast({
      title: 'Verlof aangevraagd',
      description: 'Het verlof is succesvol geregistreerd.',
    });

    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl p-8">
        <Button variant="ghost" className="mb-6" onClick={() => navigate('/')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Terug naar overzicht
        </Button>

        <h1 className="text-2xl font-semibold text-foreground mb-8">Ziek / Verlof</h1>

        <VerlofForm data={formData} onChange={setFormData} />

        <div className="flex justify-end gap-4 mt-10 pt-6 border-t border-border">
          <Button variant="outline" onClick={handleSaveConcept}>
            <Save className="mr-2 h-4 w-4" />
            Opslaan als concept
          </Button>
          <Button onClick={handleSubmit}>
            Verlof aanvragen
          </Button>
        </div>
      </div>
    </div>
  );
}
