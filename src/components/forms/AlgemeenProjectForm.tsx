import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEmployees } from '@/lib/data';

export interface AlgemeenProjectData {
  scope: string;
  gewenstePeriodeStart: string;
  gewenstePeriodeEind: string;
  betrokkenRollen: string[];
}

interface AlgemeenProjectFormProps {
  data: AlgemeenProjectData;
  onChange: (data: AlgemeenProjectData) => void;
}

export function AlgemeenProjectForm({ data, onChange }: AlgemeenProjectFormProps) {
  const { data: employees = [] } = useEmployees();
  const uniqueRoles = [...new Set(employees.map(e => e.role))];

  const handleRolToggle = (rol: string) => {
    const newRollen = data.betrokkenRollen.includes(rol)
      ? data.betrokkenRollen.filter(r => r !== rol)
      : [...data.betrokkenRollen, rol];
    onChange({ ...data, betrokkenRollen: newRollen });
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Projectdetails</h2>

      <div>
        <Label className="text-sm">Scope / Beschrijving *</Label>
        <Textarea
          value={data.scope}
          onChange={(e) => onChange({ ...data, scope: e.target.value })}
          placeholder="Beschrijf de scope en deliverables van het project..."
          rows={4}
        />
      </div>

      <div>
        <Label className="text-sm">Gewenste periode</Label>
        <div className="grid grid-cols-2 gap-4 mt-2">
          <div>
            <Label className="text-xs text-muted-foreground">Start</Label>
            <Input
              type="date"
              value={data.gewenstePeriodeStart}
              onChange={(e) => onChange({ ...data, gewenstePeriodeStart: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Eind</Label>
            <Input
              type="date"
              value={data.gewenstePeriodeEind}
              onChange={(e) => onChange({ ...data, gewenstePeriodeEind: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div>
        <Label className="text-sm mb-3 block">Betrokken rollen</Label>
        <div className="grid grid-cols-2 gap-3">
          {uniqueRoles.map((rol) => (
            <div key={rol} className="flex items-center gap-2">
              <Checkbox
                id={`rol-${rol}`}
                checked={data.betrokkenRollen.includes(rol)}
                onCheckedChange={() => handleRolToggle(rol)}
              />
              <Label htmlFor={`rol-${rol}`} className="text-sm">{rol}</Label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const emptyAlgemeenProjectData: AlgemeenProjectData = {
  scope: '',
  gewenstePeriodeStart: '',
  gewenstePeriodeEind: '',
  betrokkenRollen: [],
};
