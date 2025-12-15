import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { useWorkTypes, useEmployees } from '@/lib/data';

interface ProjectTypeFormData {
  naam: string;
  omschrijving: string;
  fases: string[];
  rollen: string[];
}

const standaardFases = [
  'Briefing',
  'Concept',
  'Uitwerking',
  'Presentatie',
  'Revisie',
  'Productie',
  'Oplevering',
];

export default function ProjecttypeToevoegen() {
  const navigate = useNavigate();
  const { data: workTypes = [] } = useWorkTypes();
  const { data: employees = [] } = useEmployees();
  
  const [formData, setFormData] = useState<ProjectTypeFormData>({
    naam: '',
    omschrijving: '',
    fases: [],
    rollen: [],
  });

  const uniqueRoles = [...new Set(employees.map(e => e.role))];

  const handleFaseToggle = (fase: string) => {
    setFormData(prev => ({
      ...prev,
      fases: prev.fases.includes(fase)
        ? prev.fases.filter(f => f !== fase)
        : [...prev.fases, fase],
    }));
  };

  const handleRolToggle = (rol: string) => {
    setFormData(prev => ({
      ...prev,
      rollen: prev.rollen.includes(rol)
        ? prev.rollen.filter(r => r !== rol)
        : [...prev.rollen, rol],
    }));
  };

  const handleSave = () => {
    if (!formData.naam) {
      toast({
        title: 'Naam is verplicht',
        description: 'Voer een naam in voor het projecttype.',
        variant: 'destructive',
      });
      return;
    }

    // For now, just store locally and show success
    toast({
      title: 'Projecttype opgeslagen',
      description: `"${formData.naam}" is toegevoegd aan de projecttypes.`,
    });

    // In the future, this would save to Google Sheets via the data service
    console.log('New project type:', formData);

    navigate('/');
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
          <h1 className="text-2xl font-semibold text-foreground">Projecttype toevoegen</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Definieer een nieuw projecttype met standaard fases en betrokken rollen.
          </p>
        </div>

        {/* Basisinformatie */}
        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Basisinformatie</h2>
          
          <div>
            <Label className="text-sm">Naam projecttype *</Label>
            <Input
              value={formData.naam}
              onChange={(e) => setFormData({ ...formData, naam: e.target.value })}
              placeholder="Bijv. Campagne, Website, Video"
            />
          </div>

          <div>
            <Label className="text-sm">Korte omschrijving</Label>
            <Textarea
              value={formData.omschrijving}
              onChange={(e) => setFormData({ ...formData, omschrijving: e.target.value })}
              placeholder="Beschrijf wanneer dit projecttype gebruikt wordt..."
              rows={3}
            />
          </div>
        </div>

        {/* Standaard fases */}
        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Standaard fases</h2>
          <p className="text-sm text-muted-foreground">
            Welke fases zitten standaard in dit projecttype?
          </p>
          
          <div className="grid grid-cols-2 gap-3">
            {standaardFases.map((fase) => (
              <div key={fase} className="flex items-center gap-2">
                <Checkbox
                  id={`fase-${fase}`}
                  checked={formData.fases.includes(fase)}
                  onCheckedChange={() => handleFaseToggle(fase)}
                />
                <Label htmlFor={`fase-${fase}`} className="text-sm">{fase}</Label>
              </div>
            ))}
          </div>

          {workTypes.length > 0 && (
            <div className="pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground mb-3">Of kies uit bestaande disciplines:</p>
              <div className="grid grid-cols-2 gap-3">
                {workTypes.map((wt) => (
                  <div key={wt.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`wt-${wt.id}`}
                      checked={formData.fases.includes(wt.label)}
                      onCheckedChange={() => handleFaseToggle(wt.label)}
                    />
                    <Label htmlFor={`wt-${wt.id}`} className="text-sm">{wt.label}</Label>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Standaard rollen */}
        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Standaard betrokken rollen</h2>
          <p className="text-sm text-muted-foreground">
            Welke rollen zijn standaard betrokken bij dit projecttype?
          </p>
          
          <div className="grid grid-cols-2 gap-3">
            {uniqueRoles.map((rol) => (
              <div key={rol} className="flex items-center gap-2">
                <Checkbox
                  id={`rol-${rol}`}
                  checked={formData.rollen.includes(rol)}
                  onCheckedChange={() => handleRolToggle(rol)}
                />
                <Label htmlFor={`rol-${rol}`} className="text-sm">{rol}</Label>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="fixed bottom-4 right-4 flex gap-2">
        <Button variant="ghost" onClick={() => navigate('/')}>
          Annuleren
        </Button>
        <Button onClick={handleSave}>
          <Save className="mr-2 h-4 w-4" />
          Projecttype opslaan
        </Button>
      </div>
    </div>
  );
}
