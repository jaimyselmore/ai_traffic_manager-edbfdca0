import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MeetingForm, MeetingFormData } from '@/components/forms/MeetingForm';
import { toast } from '@/hooks/use-toast';

const STORAGE_KEY = 'concept_meeting';

const emptyFormData: MeetingFormData = {
  klant: '',
  onderwerp: '',
  meetingType: '',
  datum: '',
  starttijd: '',
  eindtijd: '',
  locatie: '',
  medewerkers: [],
  opmerkingen: '',
};

export default function Meeting() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<MeetingFormData>(() => {
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
      description: 'Je kunt later verder werken aan deze meeting.',
    });
  };

  const handleSubmit = async () => {
    if (!formData.meetingType || !formData.onderwerp || !formData.datum || !formData.starttijd || !formData.eindtijd || formData.medewerkers.length === 0) {
      toast({
        title: 'Vul alle verplichte velden in',
        description: 'Type, onderwerp, datum, tijden en minimaal één deelnemer zijn verplicht.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Meeting wordt ingepland...',
      description: 'Even geduld alstublieft.',
    });

    await new Promise((resolve) => setTimeout(resolve, 1500));
    localStorage.removeItem(STORAGE_KEY);

    // Navigate to Ellen working page with form data
    navigate('/ellen-working', { 
      state: { 
        requestType: 'meeting',
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
        <h1 className="text-2xl font-semibold text-foreground mb-6">Meeting / Presentatie</h1>
        <MeetingForm data={formData} onChange={setFormData} />
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
