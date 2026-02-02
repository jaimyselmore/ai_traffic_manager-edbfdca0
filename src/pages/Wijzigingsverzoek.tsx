import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ExistingProjectSelector, ExistingProjectData } from '@/components/forms/ExistingProjectSelector';
import { useEmployees } from '@/hooks/use-employees';
import { useWijzigingTypes } from '@/lib/data';
import { createWijzigingsverzoek } from '@/lib/data/wijzigingenService';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

const STORAGE_KEY = 'concept_wijzigingsverzoek';

interface WijzigingsverzoekFormData {
  selectedProject: ExistingProjectData | null;
  wijzigingType: string;
  reden: string;
  urgentie: 'laag' | 'midden' | 'hoog' | '';
  // Changed values
  projectTitel: string;
  deadline: string;
  medewerkers: string[];
  budget: string;
  opmerkingen: string;
}

const emptyFormData: WijzigingsverzoekFormData = {
  selectedProject: null,
  wijzigingType: '',
  reden: '',
  urgentie: '',
  projectTitel: '',
  deadline: '',
  medewerkers: [],
  budget: '',
  opmerkingen: '',
};

export default function Wijzigingsverzoek() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: employees = [] } = useEmployees();
  const { data: wijzigingTypes = [] } = useWijzigingTypes();

  const [formData, setFormData] = useState<WijzigingsverzoekFormData>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? { ...emptyFormData, ...JSON.parse(stored) } : emptyFormData;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-populate changed values when project is selected
  useEffect(() => {
    if (formData.selectedProject && !formData.projectTitel) {
      setFormData(prev => ({
        ...prev,
        projectTitel: formData.selectedProject?.projectTitel || '',
        deadline: formData.selectedProject?.deadline || '',
        medewerkers: [], // Will need to fetch from project
        budget: '', // Will need to fetch from project
      }));
    }
  }, [formData.selectedProject]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
  }, [formData]);

  // Detect changes between original and new values
  const changes = useMemo(() => {
    if (!formData.selectedProject) return [];

    const detectedChanges: Array<{ field: string; original: string; new: string }> = [];

    if (formData.projectTitel && formData.projectTitel !== formData.selectedProject.projectTitel) {
      detectedChanges.push({
        field: 'Project Titel',
        original: formData.selectedProject.projectTitel,
        new: formData.projectTitel,
      });
    }

    if (formData.deadline && formData.deadline !== formData.selectedProject.deadline) {
      detectedChanges.push({
        field: 'Deadline',
        original: formData.selectedProject.deadline || 'Geen deadline',
        new: formData.deadline,
      });
    }

    if (formData.medewerkers.length > 0) {
      detectedChanges.push({
        field: 'Team',
        original: 'Bestaand team',
        new: `${formData.medewerkers.length} medewerkers geselecteerd`,
      });
    }

    if (formData.budget) {
      detectedChanges.push({
        field: 'Budget/Uren',
        original: 'Bestaand budget',
        new: formData.budget,
      });
    }

    return detectedChanges;
  }, [formData]);

  // Generate change summary
  const changeSummary = useMemo(() => {
    if (changes.length === 0) return '';
    return changes.map(c => `${c.field}: ${c.new}`).join(', ');
  }, [changes]);

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
    if (!formData.urgentie) {
      newErrors.urgentie = 'Selecteer een urgentie level';
    }
    if (!formData.reden || formData.reden.length < 20) {
      newErrors.reden = 'Voer een reden in (minimaal 20 karakters)';
    }
    if (changes.length === 0) {
      newErrors.changes = 'Er zijn geen wijzigingen gedetecteerd. Pas minimaal één veld aan.';
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      toast({
        title: 'Vul alle verplichte velden in',
        description: 'Project, type, urgentie, reden zijn verplicht. Maak minimaal 1 wijziging.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Build original_values from selected project
      const originalValues = {
        projectTitel: formData.selectedProject?.projectTitel,
        projectnummer: formData.selectedProject?.projectnummer,
        klantNaam: formData.selectedProject?.klantNaam,
        deadline: formData.selectedProject?.deadline,
        omschrijving: formData.selectedProject?.omschrijving,
        projectType: formData.selectedProject?.projectType,
      };

      // Build changed_values with only changed fields
      const changedValues: Record<string, unknown> = {};
      if (formData.projectTitel !== formData.selectedProject?.projectTitel) {
        changedValues.projectTitel = formData.projectTitel;
      }
      if (formData.deadline !== formData.selectedProject?.deadline) {
        changedValues.deadline = formData.deadline;
      }
      if (formData.medewerkers.length > 0) {
        changedValues.medewerkers = formData.medewerkers;
      }
      if (formData.budget) {
        changedValues.budget = formData.budget;
      }

      // Create wijzigingsverzoek in database
      await createWijzigingsverzoek(
        {
          project_id: formData.selectedProject?.projectId,
          type_wijziging: formData.wijzigingType,
          beschrijving: formData.reden,
          original_values: originalValues,
          changed_values: changedValues,
          change_summary: changeSummary,
          betrokken_mensen: formData.medewerkers.length > 0 ? formData.medewerkers : null,
          nieuwe_deadline: formData.deadline || null,
          status: 'ingediend',
        },
        user?.id || ''
      );

      toast({
        title: 'Wijzigingsverzoek ingediend',
        description: 'Het verzoek is opgeslagen en kan worden verwerkt.',
      });

      localStorage.removeItem(STORAGE_KEY);
      navigate('/');
    } catch (error) {
      console.error('Error creating wijzigingsverzoek:', error);
      toast({
        title: 'Fout bij indienen',
        description: error instanceof Error ? error.message : 'Er is een onbekende fout opgetreden',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
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

      <div className="max-w-5xl mx-auto px-6 pb-24 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Wijzigingsverzoek</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pas een bestaand project aan. Je ziet de originele waarden en kunt aangeven wat er moet veranderen.
          </p>
        </div>

        {/* Project Selector */}
        <ExistingProjectSelector
          value={formData.selectedProject?.projectId || ''}
          onChange={(data) => setFormData({ ...formData, selectedProject: data })}
          error={errors.projectId}
        />

        {/* Wijziging details */}
        {formData.selectedProject && (
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Wijzigingsdetails</h2>

            <div className="grid grid-cols-2 gap-4">
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
                <Label className="text-sm">Urgentie *</Label>
                <RadioGroup
                  value={formData.urgentie}
                  onValueChange={(value: 'laag' | 'midden' | 'hoog') =>
                    setFormData({ ...formData, urgentie: value })
                  }
                  className={errors.urgentie ? 'border border-destructive rounded-md p-2' : ''}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="laag" id="laag" />
                    <Label htmlFor="laag" className="text-sm font-normal cursor-pointer">Laag</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="midden" id="midden" />
                    <Label htmlFor="midden" className="text-sm font-normal cursor-pointer">Midden</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="hoog" id="hoog" />
                    <Label htmlFor="hoog" className="text-sm font-normal cursor-pointer">Hoog</Label>
                  </div>
                </RadioGroup>
                {errors.urgentie && (
                  <p className="text-xs text-destructive mt-1">{errors.urgentie}</p>
                )}
              </div>
            </div>

            <div>
              <Label className="text-sm">Reden van wijziging *</Label>
              <Textarea
                value={formData.reden}
                onChange={(e) => setFormData({ ...formData, reden: e.target.value })}
                placeholder="Waarom is deze wijziging nodig? (min. 20 karakters)"
                rows={3}
                className={errors.reden ? 'border-destructive' : ''}
              />
              {errors.reden && (
                <p className="text-xs text-destructive mt-1">{errors.reden}</p>
              )}
            </div>
          </div>
        )}

        {/* Side-by-side comparison */}
        {formData.selectedProject && (
          <div className="rounded-2xl border border-border bg-card p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Project Wijzigingen</h2>
              {changes.length > 0 && (
                <span className="text-sm text-muted-foreground">
                  {changes.length} wijziging{changes.length !== 1 ? 'en' : ''} gedetecteerd
                </span>
              )}
            </div>

            {/* Project Titel */}
            <div className="grid grid-cols-[1fr,auto,1fr] gap-4 items-start">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Origineel</Label>
                <div className="p-3 bg-muted/50 rounded-md border border-border">
                  <p className="text-sm font-medium">{formData.selectedProject.projectTitel}</p>
                  <p className="text-xs text-muted-foreground mt-1">Project Titel</p>
                </div>
              </div>
              <div className="flex items-center justify-center pt-8">
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Nieuwe Waarde</Label>
                <Input
                  value={formData.projectTitel}
                  onChange={(e) => setFormData({ ...formData, projectTitel: e.target.value })}
                  placeholder="Nieuwe project titel..."
                />
              </div>
            </div>

            {/* Deadline */}
            <div className="grid grid-cols-[1fr,auto,1fr] gap-4 items-start">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Origineel</Label>
                <div className="p-3 bg-muted/50 rounded-md border border-border">
                  <p className="text-sm font-medium">
                    {formData.selectedProject.deadline || 'Geen deadline'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Deadline</p>
                </div>
              </div>
              <div className="flex items-center justify-center pt-8">
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Nieuwe Deadline</Label>
                <Input
                  type="date"
                  value={formData.deadline}
                  onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                />
              </div>
            </div>

            {/* Budget/Uren */}
            <div className="grid grid-cols-[1fr,auto,1fr] gap-4 items-start">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Origineel</Label>
                <div className="p-3 bg-muted/50 rounded-md border border-border">
                  <p className="text-sm font-medium">Bestaand budget</p>
                  <p className="text-xs text-muted-foreground mt-1">Budget/Uren</p>
                </div>
              </div>
              <div className="flex items-center justify-center pt-8">
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Nieuwe Budget/Uren</Label>
                <Input
                  value={formData.budget}
                  onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                  placeholder="bijv. +15 uur of 60 uur totaal"
                />
                <p className="text-xs text-muted-foreground">
                  Geef aan hoeveel extra uren nodig zijn of het nieuwe totaal
                </p>
              </div>
            </div>

            {/* Team Members */}
            <div className="space-y-4">
              <Label className="text-sm">Team Aanpassingen (optioneel)</Label>
              <div className="grid grid-cols-2 gap-3 p-4 bg-muted/20 rounded-md border border-border">
                {employees.map((emp) => (
                  <div key={emp.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`emp-${emp.id}`}
                      checked={formData.medewerkers.includes(emp.id)}
                      onCheckedChange={() => handleMedewerkerToggle(emp.id)}
                    />
                    <Label htmlFor={`emp-${emp.id}`} className="text-sm cursor-pointer">
                      {emp.name}
                      <span className="text-muted-foreground ml-1 text-xs">({emp.role})</span>
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Opmerkingen */}
            <div className="space-y-2">
              <Label className="text-sm">Extra Opmerkingen (optioneel)</Label>
              <Textarea
                value={formData.opmerkingen}
                onChange={(e) => setFormData({ ...formData, opmerkingen: e.target.value })}
                placeholder="Aanvullende context of opmerkingen..."
                rows={3}
              />
            </div>

            {/* Change Summary */}
            {changes.length > 0 && (
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-md">
                <h3 className="text-sm font-semibold mb-2">Samenvatting Wijzigingen:</h3>
                <ul className="space-y-1">
                  {changes.map((change, idx) => (
                    <li key={idx} className="text-sm flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <div>
                        <span className="font-medium">{change.field}:</span>
                        <span className="text-muted-foreground ml-2 line-through">{change.original}</span>
                        <span className="ml-2">→ {change.new}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {errors.changes && (
              <p className="text-sm text-destructive">{errors.changes}</p>
            )}
          </div>
        )}
      </div>

      {/* Fixed bottom-right buttons */}
      <div className="fixed bottom-4 right-4 flex gap-2">
        <Button variant="ghost" onClick={handleSaveConcept}>
          <Save className="mr-2 h-4 w-4" />
          Opslaan als concept
        </Button>
        <Button onClick={handleSubmit} disabled={isSubmitting || !formData.selectedProject}>
          {isSubmitting ? 'Indienen...' : 'Verzoek indienen'}
        </Button>
      </div>
    </div>
  );
}
