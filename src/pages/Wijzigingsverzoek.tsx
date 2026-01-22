import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ExistingProjectSelector, ExistingProjectData } from '@/components/forms/ExistingProjectSelector';
import { useEmployees, useWijzigingTypes } from '@/lib/data';
import { toast } from '@/hooks/use-toast';

const STORAGE_KEY = 'concept_wijzigingsverzoek';

interface WijzigingsverzoekFormData {
  selectedProject: ExistingProjectData | null;
  wijzigingType: string;
  beschrijving: string;
  deadline: string;
  medewerkers: string[];
}

const emptyFormData: WijzigingsverzoekFormData = {
  selectedProject: null,
  wijzigingType: '',
  beschrijving: '',
  deadline: '',
  medewerkers: [],
};

export default function Wijzigingsverzoek() {
  const navigate = useNavigate();
  const { data: employees = [] } = useEmployees();
  const { data: wijzigingTypes = [] } = useWijzigingTypes();

  const [formData, setFormData] = useState<WijzigingsverzoekFormData>(() => {
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
      description: 'Je kunt later verder werken aan dit verzoek.',
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
    
    if (!formData.selectedProject) {
      newErrors.projectId = 'Selecteer een project';
    }
    if (!formData.wijzigingType) {
      newErrors.wijzigingType = 'Selecteer een type wijziging';
    }
    if (!formData.beschrijving) {
      newErrors.beschrijving = 'Voer een beschrijving in';
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      toast({
        title: 'Vul alle verplichte velden in',
        description: 'Project, type wijziging en beschrijving zijn verplicht.',
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

    navigate('/ellen-session', {
      state: {
        requestType: 'wijziging',
        formData: {
          ...formData,
          project_id: formData.selectedProject?.projectId,
          project_nummer: formData.selectedProject?.projectnummer,
          klant_naam: formData.selectedProject?.klantNaam,
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
          <h1 className="text-2xl font-semibold text-foreground">Wijzigingsverzoek</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pas de planning van een bestaand project aan (scope, timing, team of uren).
          </p>
        </div>

        {/* Existing Project Selector */}
        <ExistingProjectSelector
          value={formData.selectedProject?.projectId || ''}
          onChange={(data) => setFormData({ ...formData, selectedProject: data })}
          error={errors.projectId}
        />

        {/* Wijziging details */}
        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Wijzigingsdetails</h2>

          <div>
            <Label className="text-sm">Type wijziging *</Label>
            <Select
              value={formData.wijzigingType}
              onValueChange={(value) => setFormData({ ...formData, wijzigingType: value })}
            >
              <SelectTrigger className={errors.wijzigingType ? 'border-destructive' : ''}>
                <SelectValue placeholder="Selecteer type" />
              </SelectTrigger>
              <SelectContent>
                {wijzigingTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>{type.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.wijzigingType && (
              <p className="text-xs text-destructive mt-1">{errors.wijzigingType}</p>
            )}
          </div>

          <div>
            <Label className="text-sm">Beschrijving van de wijziging *</Label>
            <Textarea
              value={formData.beschrijving}
              onChange={(e) => setFormData({ ...formData, beschrijving: e.target.value })}
              placeholder="Beschrijf wat er moet worden aangepast..."
              rows={4}
              className={errors.beschrijving ? 'border-destructive' : ''}
            />
            {errors.beschrijving && (
              <p className="text-xs text-destructive mt-1">{errors.beschrijving}</p>
            )}
          </div>

          <div>
            <Label className="text-sm">Nieuwe deadline (indien van toepassing)</Label>
            <Input
              type="date"
              value={formData.deadline}
              onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
            />
          </div>
        </div>

        {/* Betrokken medewerkers */}
        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Betrokken medewerkers</h2>
          <p className="text-sm text-muted-foreground">
            Selecteer de medewerkers die betrokken zijn bij deze wijziging.
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
