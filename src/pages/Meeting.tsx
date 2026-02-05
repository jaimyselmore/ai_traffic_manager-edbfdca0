import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useEmployees } from '@/hooks/use-employees';
import { useMeetingTypes } from '@/lib/data';
import { toast } from '@/hooks/use-toast';
import { ProjectSelector } from '@/components/forms/ProjectSelector';

const STORAGE_KEY = 'concept_meeting';

interface MeetingFormData {
  projectId: string;
  projectTitel?: string;
  geenProject: boolean;
  onderwerp: string;
  meetingType: string;
  datum: string;
  starttijd: string;
  eindtijd: string;
  locatie: string;
  medewerkers: string[];
}

const emptyFormData: MeetingFormData = {
  projectId: '',
  projectTitel: '',
  geenProject: false,
  onderwerp: '',
  meetingType: '',
  datum: '',
  starttijd: '',
  eindtijd: '',
  locatie: '',
  medewerkers: [],
};

export default function Meeting() {
  const navigate = useNavigate();
  const { data: employees = [] } = useEmployees();
  const { data: meetingTypes = [] } = useMeetingTypes();

  const [formData, setFormData] = useState<MeetingFormData>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? { ...emptyFormData, ...JSON.parse(stored) } : emptyFormData;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

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

  const handleMedewerkerToggle = (id: string) => {
    setFormData(prev => ({
      ...prev,
      medewerkers: prev.medewerkers.includes(id)
        ? prev.medewerkers.filter(m => m !== id)
        : [...prev.medewerkers, id],
    }));
  };

  const handleSubmit = async () => {
    const newErrors: Record<string, string> = {};

    // Only require project if geenProject is not checked
    if (!formData.geenProject && !formData.projectId) {
      newErrors.projectId = 'Selecteer een project of vink "Geen project" aan';
    }
    if (!formData.meetingType) {
      newErrors.meetingType = 'Selecteer een type';
    }
    if (!formData.onderwerp) {
      newErrors.onderwerp = 'Voer een onderwerp in';
    }
    if (!formData.datum) {
      newErrors.datum = 'Selecteer een datum';
    }
    if (!formData.starttijd || !formData.eindtijd) {
      newErrors.tijd = 'Voer start- en eindtijd in';
    }
    if (!formData.locatie) {
      newErrors.locatie = 'Voer een locatie in';
    }
    if (formData.medewerkers.length === 0) {
      newErrors.medewerkers = 'Selecteer minimaal één deelnemer';
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      toast({
        title: 'Vul alle verplichte velden in',
        description: formData.geenProject
          ? 'Type, onderwerp, datum, tijden, locatie en minimaal één deelnemer zijn verplicht.'
          : 'Project, type, onderwerp, datum, tijden, locatie en minimaal één deelnemer zijn verplicht.',
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

    navigate('/ellen-session', {
      state: {
        requestType: 'meeting',
        formData: {
          ...formData,
          plan_status: 'concept',
        },
      },
    });
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="w-full px-6 pt-6 mb-4">
        <button
          type="button"
          className="text-sm text-muted-foreground hover:text-foreground"
          onClick={() => navigate('/')}
        >
          ← Terug naar overzicht
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-6 pb-24 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Meeting / Presentatie</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Plan een interne of externe meeting of presentatie en koppel die aan het juiste project en team.
          </p>
        </div>

        {/* Project koppeling */}
        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Project koppeling *</h2>
          <p className="text-sm text-muted-foreground">
            Koppel deze meeting aan een bestaand project, of plan deze standalone.
          </p>

          {/* Project selector - only show when geen project is NOT checked */}
          {!formData.geenProject && (
            <ProjectSelector
              value={formData.projectId}
              onChange={(projectData) => {
                if (projectData) {
                  setFormData({
                    ...formData,
                    projectId: projectData.projectId,
                    projectTitel: projectData.projectTitel
                  });
                } else {
                  setFormData({
                    ...formData,
                    projectId: '',
                    projectTitel: ''
                  });
                }
              }}
              error={errors.projectId}
            />
          )}

          {/* Geen project checkbox - below the dropdown */}
          <div className="flex items-center gap-2 p-3 bg-secondary/30 rounded-lg">
            <Checkbox
              id="geen-project"
              checked={formData.geenProject}
              onCheckedChange={(checked) => {
                setFormData({
                  ...formData,
                  geenProject: checked as boolean,
                  // Clear project selection when checking "geen project"
                  projectId: checked ? '' : formData.projectId,
                  projectTitel: checked ? '' : formData.projectTitel,
                });
                // Clear project error when checking "geen project"
                if (checked && errors.projectId) {
                  setErrors({ ...errors, projectId: '' });
                }
              }}
            />
            <Label htmlFor="geen-project" className="text-sm font-medium cursor-pointer">
              Geen project
            </Label>
          </div>
        </div>

        {/* Meeting details */}
        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Meetingdetails</h2>

          <div>
            <Label className="text-sm">Type *</Label>
            <Select
              value={formData.meetingType}
              onValueChange={(value) => setFormData({ ...formData, meetingType: value })}
            >
              <SelectTrigger className={errors.meetingType ? 'border-destructive' : ''}>
                <SelectValue placeholder="Selecteer type" />
              </SelectTrigger>
              <SelectContent>
                {meetingTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>{type.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.meetingType && (
              <p className="text-xs text-destructive mt-1">{errors.meetingType}</p>
            )}
          </div>

          <div>
            <Label className="text-sm">Onderwerp *</Label>
            <Input
              value={formData.onderwerp}
              onChange={(e) => setFormData({ ...formData, onderwerp: e.target.value })}
              placeholder="Onderwerp van de meeting"
              className={errors.onderwerp ? 'border-destructive' : ''}
            />
            {errors.onderwerp && (
              <p className="text-xs text-destructive mt-1">{errors.onderwerp}</p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-sm">Datum *</Label>
              <Input
                type="date"
                value={formData.datum}
                onChange={(e) => setFormData({ ...formData, datum: e.target.value })}
                className={errors.datum ? 'border-destructive' : ''}
              />
            </div>
            <div>
              <Label className="text-sm">Starttijd *</Label>
              <Input
                type="time"
                value={formData.starttijd}
                onChange={(e) => setFormData({ ...formData, starttijd: e.target.value })}
                className={errors.tijd ? 'border-destructive' : ''}
              />
            </div>
            <div>
              <Label className="text-sm">Eindtijd *</Label>
              <Input
                type="time"
                value={formData.eindtijd}
                onChange={(e) => setFormData({ ...formData, eindtijd: e.target.value })}
                className={errors.tijd ? 'border-destructive' : ''}
              />
            </div>
          </div>
          {errors.datum && <p className="text-xs text-destructive">{errors.datum}</p>}
          {errors.tijd && <p className="text-xs text-destructive">{errors.tijd}</p>}

          <div>
            <Label className="text-sm">Locatie *</Label>
            <Input
              placeholder="Bijv. Vergaderruimte A, Teams, of extern adres"
              value={formData.locatie}
              onChange={(e) => {
                setFormData({
                  ...formData,
                  locatie: e.target.value
                });
              }}
              className={errors.locatie ? 'border-destructive' : ''}
            />
            {errors.locatie && (
              <p className="text-xs text-destructive mt-1">{errors.locatie}</p>
            )}
          </div>
        </div>

        {/* Deelnemers */}
        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Deelnemers *</h2>
          <p className="text-sm text-muted-foreground">
            Selecteer de medewerkers die aanwezig moeten zijn.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {employees.map((emp) => (
              <div key={emp.id} className="flex items-center gap-2">
                <Checkbox
                  id={`emp-${emp.id}`}
                  checked={formData.medewerkers.includes(emp.id)}
                  onCheckedChange={() => handleMedewerkerToggle(emp.id)}
                />
                <Label htmlFor={`emp-${emp.id}`} className="text-sm">
                  {emp.name}
                  <span className="text-muted-foreground ml-1 text-xs">({emp.role})</span>
                </Label>
              </div>
            ))}
          </div>
          {errors.medewerkers && (
            <p className="text-xs text-destructive">{errors.medewerkers}</p>
          )}
        </div>
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
