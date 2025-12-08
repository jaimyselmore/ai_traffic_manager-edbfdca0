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

    // Navigate to Ellen working page
    navigate('/ellen-working', { state: { requestType: 'meeting' } });
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="max-w-3xl mx-auto px-8 py-8">
        {/* Header: back link + title on one line */}
        <div className="flex items-center gap-4 mb-8">
          <button
            type="button"
            className="text-sm text-muted-foreground hover:text-foreground"
            onClick={() => navigate('/')}
          >
            ← Terug naar overzicht
          </button>
          <h1 className="text-2xl font-semibold text-foreground">Meeting / Presentatie</h1>
        </div>

        {/* Form */}
        <MeetingForm data={formData} onChange={setFormData} />

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
