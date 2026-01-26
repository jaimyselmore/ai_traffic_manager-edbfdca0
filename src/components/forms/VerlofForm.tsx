import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useEmployees } from '@/hooks/use-employees';
import { useVerlofTypes } from '@/lib/data';

export interface VerlofFormData {
  medewerker: string;
  verlofType: string;
  startdatum: string;
  einddatum: string;
  reden: string;
}

interface VerlofFormProps {
  data: VerlofFormData;
  onChange: (data: VerlofFormData) => void;
}

export function VerlofForm({ data, onChange }: VerlofFormProps) {
  const { data: employees = [] } = useEmployees();
  const { data: verlofTypes = [] } = useVerlofTypes();

  const handleFieldChange = (field: keyof VerlofFormData, value: string) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="medewerker">Medewerker *</Label>
        <Select
          value={data.medewerker || ''}
          onValueChange={(value) => handleFieldChange('medewerker', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecteer medewerker" />
          </SelectTrigger>
          <SelectContent>
            {employees.map((emp) => (
              <SelectItem key={emp.id} value={emp.id}>
                {emp.name} <span className="text-muted-foreground">({emp.role})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="verlofType">Type *</Label>
        <Select
          value={data.verlofType || ''}
          onValueChange={(value) => handleFieldChange('verlofType', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecteer type" />
          </SelectTrigger>
          <SelectContent>
            {verlofTypes.map((type) => (
              <SelectItem key={type.id} value={type.id}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="startdatum">Startdatum *</Label>
          <Input
            id="startdatum"
            type="date"
            value={data.startdatum || ''}
            onChange={(e) => handleFieldChange('startdatum', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="einddatum">Einddatum *</Label>
          <Input
            id="einddatum"
            type="date"
            value={data.einddatum || ''}
            onChange={(e) => handleFieldChange('einddatum', e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="reden">Reden / Toelichting</Label>
        <Textarea
          id="reden"
          placeholder="Optionele toelichting..."
          rows={3}
          value={data.reden || ''}
          onChange={(e) => handleFieldChange('reden', e.target.value)}
        />
      </div>
    </div>
  );
}
