import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VerlofForm, VerlofFormData } from '@/components/forms/VerlofForm';
import { toast } from '@/hooks/use-toast';
import { secureInsert } from '@/lib/data/secureDataClient';

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

    try {
      // Direct insert into beschikbaarheid_medewerkers table
      const { error } = await secureInsert('beschikbaarheid_medewerkers', {
        werknemer_naam: formData.medewerker,
        type: formData.verlofType, // 'verlof' of 'ziek'
        start_datum: formData.startdatum,
        eind_datum: formData.einddatum,
        reden: formData.reden || `${formData.verlofCategorie}${formData.backupPersoon ? ` - Backup: ${formData.backupPersoon}` : ''}`,
        status: 'goedgekeurd',
      });

      if (error) {
        throw new Error(error.message);
      }

      localStorage.removeItem(STORAGE_KEY);
      toast({
        title: formData.verlofType === 'ziek' ? 'Ziekmelding geregistreerd!' : 'Verlof aangevraagd!',
        description: 'De beschikbaarheid is bijgewerkt in de planning.',
      });
      navigate('/');
    } catch (err) {
      console.error('Beschikbaarheid opslaan fout:', err);
      toast({
        title: 'Er ging iets mis',
        description: err instanceof Error ? err.message : 'Kon de beschikbaarheid niet opslaan.',
        variant: 'destructive',
      });
    }
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
